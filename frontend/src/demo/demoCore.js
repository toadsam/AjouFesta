// 연습용 서버의 공통 조각.

/** 이 영역이 맡지 않는 주소일 때 route 가 돌려주는 값. */
export const NOT_HANDLED = Symbol("not-handled");

export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const pad = (value) => String(value).padStart(2, "0");

/** 서버가 주는 시각과 같은 모양: 시간대 없는 "2026-10-07T18:40:12". */
export function formatStamp(ms) {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** "2026-10-07T18:40:12" → ms. */
export function parseStamp(value) {
  if (!value) return 0;
  const time = new Date(`${value}`.slice(0, 19)).getTime();
  return Number.isFinite(time) ? time : 0;
}
