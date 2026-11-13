// 축제 부하 시험. 외부 패키지 없이 Node 기본 모듈만 쓴다.
//
//   node scripts/load/festival-load.mjs --base http://localhost:18080 --sse 6000 --visitors 600 --seconds 60
//
// 하는 일
//   1) SSE 연결을 --sse 개 열어 둔다(events · notices · booths · congestion 네 통로에 고르게).
//   2) 가상 방문자 --visitors 명이 --seconds 초 동안 화면을 넘긴다.
//      한 사람은 부스 목록 → 공연 일정 → 공지를 차례로 부르고 0.3~0.7초 쉰 뒤 되풀이한다.
//      부하를 만드는 Node 프로세스도 스레드가 하나다. 방문자 600명을 한 프로세스에 몰면 서버가 아니라
//      이 스크립트가 밀린다. run-split.mjs 가 방문자를 여러 프로세스로 나눠 돌리고 결과를 합친다.
//   3) 끝나면 초당 요청 수, 응답 시간 분포, 오류 수, SSE 가 몇 개 살아 있었는지를 JSON 한 줄로 찍는다.
//
// 재는 것은 서버가 답을 돌려주기까지의 시간이다. 화면이 그려지는 시간이 아니다.
// 같은 컴퓨터에서 서버와 부하를 같이 돌리면 둘이 CPU 를 나눠 쓴다. 결과에 그 조건을 같이 적는다.

import http from "node:http";
import https from "node:https";
import os from "node:os";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), all[i + 1]]);
    return acc;
  }, [])
);
const BASE = new URL(args.base ?? "http://localhost:8080");
const SSE = Number(args.sse ?? 6000);
const VISITORS = Number(args.visitors ?? 600);
const SECONDS = Number(args.seconds ?? 60);
const lib = BASE.protocol === "https:" ? https : http;

const sseAgent = new lib.Agent({keepAlive: true, maxSockets: Infinity});
const apiAgent = new lib.Agent({keepAlive: true, maxSockets: VISITORS});

const SSE_PATHS = ["/api/stream/events", "/api/stream/notices", "/api/stream/booths", "/api/stream/congestion"];
const PAGES = ["/api/booths", "/api/events", "/api/notices/active"];

const sse = {opened: 0, failed: 0, dropped: 0};
const sockets = [];

function openSse(path) {
  return new Promise(resolve => {
    const req = lib.get({host: BASE.hostname, port: BASE.port, path, agent: sseAgent, headers: {Accept: "text/event-stream"}}, res => {
      if (res.statusCode !== 200) {
        sse.failed++;
        res.resume();
        return resolve();
      }
      sse.opened++;
      sockets.push(req);
      res.on("data", () => {});
      res.on("close", () => {
        if (!stopping) sse.dropped++;
      });
      resolve();
    });
    req.on("error", () => {
      sse.failed++;
      resolve();
    });
  });
}

let stopping = false;
const latencies = [];
const byStatus = new Map();
let errors = 0;

function get(path) {
  return new Promise(resolve => {
    const started = process.hrtime.bigint();
    const req = lib.get({host: BASE.hostname, port: BASE.port, path, agent: apiAgent, headers: {"Accept-Encoding": "gzip"}}, res => {
      res.on("data", () => {});
      res.on("end", () => {
        latencies.push(Number(process.hrtime.bigint() - started) / 1e6);
        byStatus.set(res.statusCode, (byStatus.get(res.statusCode) ?? 0) + 1);
        if (res.statusCode >= 400) errors++;
        resolve();
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error("timeout")));
    req.on("error", () => {
      errors++;
      byStatus.set("network", (byStatus.get("network") ?? 0) + 1);
      resolve();
    });
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function visitor(until) {
  await sleep(Math.random() * 1000); // 한꺼번에 출발하지 않게
  while (Date.now() < until) {
    for (const path of PAGES) {
      if (Date.now() >= until) break;
      await get(path);
    }
    await sleep(300 + Math.random() * 400);
  }
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

// 1) SSE 를 200개씩 끊어서 연다. 한꺼번에 열면 접속 대기열이 넘쳐 시험 자체가 깨진다.
const sseStarted = Date.now();
for (let i = 0; i < SSE; i += 200) {
  const batch = [];
  for (let j = i; j < Math.min(i + 200, SSE); j++) batch.push(openSse(SSE_PATHS[j % SSE_PATHS.length]));
  await Promise.all(batch);
}
const sseOpenSeconds = (Date.now() - sseStarted) / 1000;

// 2) 방문자
const started = Date.now();
const until = started + SECONDS * 1000;
if (VISITORS > 0) await Promise.all(Array.from({length: VISITORS}, () => visitor(until)));
else await sleep(SECONDS * 1000); // SSE 만 쥐고 있는 프로세스
const elapsed = (Date.now() - started) / 1000;

// 3) 결과
stopping = true;
const sorted = latencies.slice().sort((a, b) => a - b);
const round = n => (n == null ? null : Math.round(n * 10) / 10);
const result = {
  date: new Date().toISOString(),
  base: BASE.origin,
  sse: {asked: SSE, opened: sse.opened, failed: sse.failed, droppedDuringRun: sse.dropped, openSeconds: round(sseOpenSeconds)},
  visitors: VISITORS,
  seconds: round(elapsed),
  requests: latencies.length + (byStatus.get("network") ?? 0),
  requestsPerSecond: round(latencies.length / elapsed),
  latencyMs: {p50: round(percentile(sorted, 50)), p95: round(percentile(sorted, 95)), p99: round(percentile(sorted, 99)), max: round(sorted.at(-1))},
  errors,
  byStatus: Object.fromEntries(byStatus),
  machine: {cpus: os.cpus().length, cpu: os.cpus()[0]?.model, memGb: Math.round(os.totalmem() / 2 ** 30), platform: `${os.platform()} ${os.release()}`, node: process.version}
};
// --raw 파일을 주면 응답 시간을 그대로 남긴다. 프로세스 여럿의 결과를 합쳐 분포를 다시 낼 때 쓴다.
if (args.raw) (await import("node:fs")).writeFileSync(args.raw, JSON.stringify({latencies, errors, seconds: elapsed}));
console.log(JSON.stringify(result));
for (const s of sockets) s.destroy();
sseAgent.destroy();
apiAgent.destroy();
process.exit(0);
