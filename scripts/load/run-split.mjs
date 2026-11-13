// 방문자를 프로세스 여럿으로 나눠 돌리고 응답 시간을 합쳐 분포를 낸다.
//
//   node scripts/load/run-split.mjs --base http://localhost:18080 --sse 6000 --visitors 600 --seconds 60 --workers 6
//
// 프로세스 하나가 SSE 를 전부 쥐고, 나머지가 방문자를 나눠 맡는다.
import {spawn} from "node:child_process";
import {readFileSync, rmSync, mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import os from "node:os";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), all[i + 1]]);
    return acc;
  }, [])
);
const base = args.base ?? "http://localhost:8080";
const sse = Number(args.sse ?? 6000);
const visitors = Number(args.visitors ?? 600);
const seconds = Number(args.seconds ?? 60);
const workers = Number(args.workers ?? 6);
const script = join(dirname(fileURLToPath(import.meta.url)), "festival-load.mjs");
const dir = mkdtempSync(join(tmpdir(), "festival-load-"));

const run = (extra) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [script, "--base", base, ...extra], {stdio: ["ignore", "pipe", "inherit"]});
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("close", () => resolve(out.trim() ? JSON.parse(out.trim().split("\n").pop()) : null));
  });

// SSE 를 먼저 다 연 뒤에 방문자를 출발시킨다. SSE 프로세스는 방문자보다 오래 쥐고 있는다.
const holder = run(["--sse", String(sse), "--visitors", "0", "--seconds", String(seconds + 40)]);
await new Promise((r) => setTimeout(r, Math.max(8000, sse * 4)));

const per = Math.ceil(visitors / workers);
const started = Date.now();
const results = await Promise.all(
  Array.from({length: workers}, (_, i) =>
    run(["--sse", "0", "--visitors", String(Math.min(per, visitors - i * per)), "--seconds", String(seconds), "--raw", join(dir, `w${i}.json`)])
  )
);
const elapsed = (Date.now() - started) / 1000;
const held = await holder;

let latencies = [];
let errors = 0;
for (let i = 0; i < workers; i++) {
  const raw = JSON.parse(readFileSync(join(dir, `w${i}.json`), "utf8"));
  latencies = latencies.concat(raw.latencies);
  errors += raw.errors;
}
rmSync(dir, {recursive: true, force: true});
latencies.sort((a, b) => a - b);
const pct = (p) => Math.round(latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))] * 10) / 10;
const total = results.reduce((n, r) => n + (r?.requests ?? 0), 0);
console.log(
  JSON.stringify({
    date: new Date().toISOString(),
    base,
    workers,
    sse: held?.sse,
    visitors,
    seconds,
    requests: total,
    requestsPerSecond: Math.round((latencies.length / seconds) * 10) / 10,
    latencyMs: {p50: pct(50), p95: pct(95), p99: pct(99), max: pct(100)},
    errors,
    machine: {cpus: os.cpus().length, cpu: os.cpus()[0]?.model, memGb: Math.round(os.totalmem() / 2 ** 30), platform: `${os.platform()} ${os.release()}`, node: process.version}
  })
);
