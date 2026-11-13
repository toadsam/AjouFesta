// 눌러 보는 매뉴얼(/guide/live)의 연습용 서버.
// 진짜 화면을 iframe 으로 띄우고, 그 화면이 보내는 요청을 여기서 받아 실제 서버와 같은 규칙으로 답한다.
// 전부 이 페이지의 메모리 안에서만 돈다. 실제 서버로는 아무것도 나가지 않는다.
// 규칙은 영역별 파일에 있다: 주점 주문 pubDomain.js · 사주 소개팅 aimatchDomain.js · 총괄 공지와 공연 festDomain.js · 분실물 lostDomain.js.
import { NOT_HANDLED, formatStamp, httpError, parseStamp } from "./demoCore";
import { createPubDomain } from "./pubDomain";
import { createAimatchDomain } from "./aimatchDomain";
import { createFestDomain } from "./festDomain";
import { createLostDomain } from "./lostDomain";

export { DEMO_BOOTH_ID, DEMO_OPS_KEY } from "./pubDomain";
export { DEMO_ADMIN_TOKEN, DEMO_PIN } from "./aimatchDomain";

export function createDemoServer() {
  const subscribers = new Map(); // 실시간 통로 이름 -> Set<fn>
  const listeners = new Set(); // 매뉴얼 화면이 듣는다
  // 연습용 시계. '약속 시간으로 건너뛰기' 같은 버튼이 offset 을 늘린다. iframe 속 화면의 시계(Date)도 같은 값을 본다.
  const clock = { offset: 0 };
  const nowMs = () => Date.now() + clock.offset;
  const stamp = (ms = nowMs()) => formatStamp(ms);

  function publish(channel, payload) {
    const set = subscribers.get(channel);
    if (!set) return;
    [...set].forEach((fn) => {
      try {
        fn(channel, payload);
      } catch {
        set.delete(fn); // 닫힌 화면
      }
    });
  }

  function emit(event) {
    listeners.forEach((fn) => {
      try {
        fn(event);
      } catch {
        // 매뉴얼 화면 쪽 오류로 연습 서버가 멈추지 않게 한다.
      }
    });
  }

  const context = { nowMs, stamp, publish, emit, clock };
  const domains = { pub: createPubDomain(context), aimatch: createAimatchDomain(context), fest: createFestDomain(context), lost: createLostDomain(context) };

  return {
    clock,
    /** iframe 안 화면이 보내는 요청. { status, body } 로 답한다. */
    async request({ role, method = "GET", path, query, body, headers = {} }) {
      await new Promise((resolve) => setTimeout(resolve, 160)); // 통신하는 느낌
      try {
        const lower = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
        const args = [method.toUpperCase(), path, new URLSearchParams(query || ""), body, lower, role];
        for (const domain of Object.values(domains)) {
          const result = domain.route(...args);
          if (result !== NOT_HANDLED) return { status: 200, body: result };
        }
        throw httpError(404, "연습 화면에는 없는 기능이에요.");
      } catch (error) {
        if (!error.status) throw error;
        return { status: error.status, body: { message: error.message } };
      }
    },
    /** 실시간 통로 구독. 끊는 함수를 돌려준다. */
    subscribe(channel, fn) {
      if (!subscribers.has(channel)) subscribers.set(channel, new Set());
      subscribers.get(channel).add(fn);
      return () => subscribers.get(channel)?.delete(fn);
    },
    /** 매뉴얼 화면이 '무슨 일이 일어났는지' 듣는다. */
    listen(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** 매뉴얼 화면의 '건너뛰기' 버튼 같은, 화면 밖에서 하는 조작. */
    act(domain, name, payload) {
      return domains[domain]?.act?.(name, payload);
    },
    snapshot() {
      return Object.fromEntries(Object.entries(domains).map(([name, domain]) => [name, domain.snapshot()]));
    },
    /** clockStart("2026-10-07T12:57:00")를 주면 연습용 시계를 그 시각에서 시작한다. 안 주면 지금 시각. */
    reset({ clockStart } = {}) {
      clock.offset = clockStart ? parseStamp(clockStart) - Date.now() : 0;
      subscribers.clear();
      Object.values(domains).forEach((domain) => domain.reset());
    },
  };
}
