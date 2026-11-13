// 눌러 보는 매뉴얼(/guide/live)이 iframe 으로 띄운 화면에서만 켜진다.
// 켜지면 이 화면의 서버 요청 · 실시간 통로 · 저장소가 전부 매뉴얼 페이지 안의 연습용 서버(demoServer.js)로 간다.
// 보통 방문에서는 아무것도 하지 않는다: iframe 이름이 "ffdemo:" 로 시작하고, 같은 사이트의 부모 창이 연습용 서버를 들고 있을 때만 켜진다.
import { getApiBase } from "../api";

const NAME_PREFIX = "ffdemo:";

function findHost() {
  try {
    if (window.parent === window) return null;
    if (typeof window.name !== "string" || !window.name.startsWith(NAME_PREFIX)) return null;
    // 다른 사이트가 이 화면을 끼워 넣은 경우에는 부모 창을 읽을 수 없어 여기서 예외가 난다 → 보통 화면으로 뜬다.
    return window.parent.__ffDemoHost || null;
  } catch {
    return null;
  }
}

// 부모 창이 들고 있는 Map 을 localStorage · sessionStorage 처럼 쓴다. 실제 저장소(로그인 · 장바구니 · 운영 키)는 건드리지 않는다.
function memoryStorage(map) {
  return {
    getItem: (key) => (map.has(String(key)) ? map.get(String(key)) : null),
    setItem: (key, value) => {
      map.set(String(key), String(value));
    },
    removeItem: (key) => {
      map.delete(String(key));
    },
    clear: () => map.clear(),
    key: (index) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size;
    },
  };
}

function install(host) {
  const role = window.name.slice(NAME_PREFIX.length);
  const rule = host.rules?.[role];
  if (!rule) return false;
  const apiBase = new URL(getApiBase(), window.location.href);
  const isApiUrl = (url) => {
    try {
      return new URL(url, window.location.href).href.startsWith(`${apiBase.href}/`);
    } catch {
      return false;
    }
  };

  /* ----- 저장소 ----- */
  const stores = host.storageFor(role);
  const swap = (name, map) => {
    const storage = memoryStorage(map);
    try {
      Object.defineProperty(window, name, { configurable: true, get: () => storage });
    } catch {
      // 못 바꾸면 아래 확인에서 걸러진다.
    }
    return window[name] === storage;
  };
  // 저장소를 못 바꾼 브라우저에서는 연습 화면을 켜지 않는다(실제 저장소에 연습용 값이 섞이면 안 된다).
  if (!swap("localStorage", stores.local) || !swap("sessionStorage", stores.session)) return false;

  /* ----- 서버 요청 ----- */
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || String(input);
    if (!isApiUrl(url)) return realFetch(input, init);
    const parsed = new URL(url, window.location.href);
    let body;
    if (typeof init.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    } else if (init.body instanceof FormData) {
      // 사진과 함께 보내는 등록(분실물). 글자 칸은 그대로, 사진은 이 브라우저 안에서만 보이는 주소로 바꿔 넘긴다(어디에도 올라가지 않는다).
      body = {};
      init.body.forEach((value, key) => {
        body[key] = typeof value === "string" ? value : { name: value.name, type: value.type, size: value.size, url: URL.createObjectURL(value) };
      });
    }
    const headers = {};
    new Headers(init.headers || {}).forEach((value, key) => {
      headers[key] = value;
    });
    const result = await host.server.request({
      role,
      method: init.method || "GET",
      path: parsed.pathname.slice(apiBase.pathname.length),
      query: parsed.search,
      body,
      headers,
    });
    if (result.body === undefined) return new Response("", { status: result.status });
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { "content-type": "application/json" },
    });
  };

  /* ----- 실시간 통로 ----- */
  const RealEventSource = window.EventSource;
  const openStreams = new Set();
  class DemoEventSource {
    constructor(url) {
      this.url = url;
      this.readyState = 1;
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      this.handlers = new Map();
      const channel = new URL(url, window.location.href).pathname.split("/stream/")[1] || "";
      this.off = host.server.subscribe(channel, (name, payload) => {
        // 실제 서버처럼 조금 뒤에 도착한다.
        window.setTimeout(() => {
          if (this.readyState !== 1) return;
          const event = new MessageEvent(name, { data: JSON.stringify(payload) });
          (this.handlers.get(name) || []).forEach((handler) => handler(event));
        }, 120);
      });
      openStreams.add(this);
      window.setTimeout(() => this.onopen?.(new Event("open")), 0);
    }

    addEventListener(name, handler) {
      if (!this.handlers.has(name)) this.handlers.set(name, []);
      this.handlers.get(name).push(handler);
    }

    removeEventListener(name, handler) {
      const list = this.handlers.get(name);
      if (list) this.handlers.set(name, list.filter((item) => item !== handler));
    }

    close() {
      this.readyState = 2;
      this.off?.();
      openStreams.delete(this);
    }
  }
  window.EventSource = function DemoAwareEventSource(url, options) {
    return isApiUrl(`${url}`) ? new DemoEventSource(`${url}`) : new RealEventSource(url, options);
  };
  window.addEventListener("pagehide", () => [...openStreams].forEach((stream) => stream.close()));

  /* ----- 화면 이동: 연습에 쓰는 화면 밖으로는 나가지 않는다 ----- */
  // 브라우저 '뒤로'가 연습 화면 안의 이동으로 쌓이지 않게, 주소는 늘 바꿔 끼우고 지나온 길은 따로 기억한다.
  const allowed = (pathname) => rule.allow.some((pattern) => pattern.test(pathname));
  const realReplace = window.history.replaceState.bind(window.history);
  const resolve = (url) => {
    const next = new URL(url, window.location.href);
    if (allowed(decodeURIComponent(next.pathname))) return `${next.pathname}${next.search}${next.hash}`;
    host.onBlocked?.(role, next.pathname);
    return rule.home;
  };
  if (!allowed(decodeURIComponent(window.location.pathname))) realReplace(null, "", rule.home);
  const trail = [`${window.location.pathname}${window.location.search}`];
  window.history.pushState = (state, title, url) => {
    if (url == null) return realReplace(state, title);
    const next = resolve(url);
    trail.push(next);
    return realReplace(state, title, next);
  };
  window.history.replaceState = (state, title, url) => {
    if (url == null) return realReplace(state, title);
    const next = resolve(url);
    trail[trail.length - 1] = next;
    return realReplace(state, title, next);
  };
  window.history.go = (delta = 0) => {
    if (delta >= 0) return;
    const target = Math.max(0, trail.length - 1 + delta);
    if (target === trail.length - 1) return;
    trail.length = target + 1;
    realReplace(null, "", trail[target]);
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
  };
  window.history.back = () => window.history.go(-1);

  /* ----- 시계: 매뉴얼의 '건너뛰기'가 연습용 서버의 시각을 앞당기면 이 화면의 시계도 같이 간다 ----- */
  const RealDate = window.Date;
  const offset = () => host.server.clock?.offset || 0;
  function DemoDate(...args) {
    if (!new.target) return new RealDate(RealDate.now() + offset()).toString();
    return args.length ? new RealDate(...args) : new RealDate(RealDate.now() + offset());
  }
  DemoDate.prototype = RealDate.prototype;
  DemoDate.now = () => RealDate.now() + offset();
  DemoDate.parse = RealDate.parse;
  DemoDate.UTC = RealDate.UTC;
  window.Date = DemoDate;

  /* ----- 기다림 줄이기 ----- */
  // 실제 화면은 신청함을 15초, 운영진 시간표를 10초마다 다시 읽는다. 연습에서는 그 기다림만 2초로 줄인다(화면이 하는 일은 같다).
  const realSetInterval = window.setInterval.bind(window);
  window.setInterval = (handler, delay, ...rest) => realSetInterval(handler, delay >= 5000 ? 2000 : delay, ...rest);

  document.documentElement.setAttribute("data-ffdemo", role);
  return true;
}

const host = findHost();

/** 이 화면이 눌러 보는 매뉴얼 안의 연습 화면이면 true. */
export const isDemoFrame = host ? install(host) : false;
