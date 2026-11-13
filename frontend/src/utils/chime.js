// 스태프 화면의 알림 소리 셋: 새 주문(입금 확인할 것) · 주방에 넘어온 주문 · 음식 나옴(서빙할 것).
// 시끄러운 주점에서도 들리게 2초쯤 길게, 기기 소리가 허락하는 가장 큰 크기로 낸다. 종류마다 가락이 달라 화면을 안 보고도 구별한다.
//
// 소리는 코드로 만들어(파일 없음) <audio> 로 튼다. <audio> 는 아이폰이 무음 스위치를 켜 둬도 미디어 음량으로 나온다.
// 브라우저는 화면을 한 번 누르기 전에는 소리를 막는다. 처음 누를 때 소리 통로를 열어 두고 그 뒤로 계속 쓴다.
const RATE = 22050;
const TWO_PI = Math.PI * 2;

/** 종 소리: 땡 하고 울린 뒤 잦아든다. 배음을 섞어 작은 스피커에서도 또렷하게. */
function bell(out, at, duration, frequency) {
  const start = Math.floor(at * RATE);
  const length = Math.floor(duration * RATE);
  for (let i = 0; i < length && start + i < out.length; i += 1) {
    const t = i / RATE;
    const attack = Math.min(1, t / 0.004);
    const decay = Math.exp((-t * 2.6) / duration);
    const release = Math.min(1, (duration - t) / 0.02);
    const wave =
      Math.sin(TWO_PI * frequency * t) + 0.55 * Math.sin(TWO_PI * frequency * 2 * t) + 0.3 * Math.sin(TWO_PI * frequency * 3 * t);
    out[start + i] += wave * attack * decay * release;
  }
}

/** 삐 소리: 딱 끊어지는 경보음. 주방 소음을 뚫고 나오게 각진 음색. */
function beep(out, at, duration, frequency) {
  const start = Math.floor(at * RATE);
  const length = Math.floor(duration * RATE);
  for (let i = 0; i < length && start + i < out.length; i += 1) {
    const t = i / RATE;
    const edge = Math.min(1, t / 0.004, (duration - t) / 0.008);
    // 다섯째 배음은 이 표본 속도로 담을 수 있는 높이일 때만 섞는다.
    const fifth = frequency * 5 < RATE * 0.45 ? 0.2 * Math.sin(TWO_PI * frequency * 5 * t) : 0;
    const wave = Math.sin(TWO_PI * frequency * t) + 0.45 * Math.sin(TWO_PI * frequency * 3 * t) + fifth;
    out[start + i] += wave * edge * 1.1;
  }
}

const SOUNDS = {
  // 새 주문(입금 대기): 초인종 '딩동' 두 번.
  order: {
    seconds: 2.1,
    vibrate: [200, 100, 200],
    draw(out) {
      [0, 1.0].forEach((at) => {
        bell(out, at, 0.5, 1319);
        bell(out, at + 0.36, 0.7, 1047);
      });
    },
  },
  // 주방에 넘어온 주문: 빠른 '삐삐삑' 세 번.
  kitchen: {
    seconds: 2.2,
    vibrate: [120, 60, 120, 60, 240],
    draw(out) {
      [0, 0.74, 1.48].forEach((at) => {
        beep(out, at, 0.11, 1760);
        beep(out, at + 0.16, 0.11, 1760);
        beep(out, at + 0.32, 0.2, 2349);
      });
    },
  },
  // 음식 나옴(서빙할 것): 올라가는 가락 두 번.
  ready: {
    seconds: 2.4,
    vibrate: [100, 60, 100, 60, 100, 60, 300],
    draw(out) {
      [0, 1.15].forEach((at) => {
        bell(out, at, 0.22, 1047);
        bell(out, at + 0.13, 0.22, 1319);
        bell(out, at + 0.26, 0.22, 1568);
        bell(out, at + 0.39, 0.75, 2093);
      });
    },
  },
};

function render(sound) {
  const out = new Float32Array(Math.ceil(sound.seconds * RATE));
  sound.draw(out);
  // 겹친 음이 찢어지지 않게 부드럽게 눌러서 최대 크기에 맞춘다.
  for (let i = 0; i < out.length; i += 1) out[i] = Math.tanh(out[i] * 1.6) * 0.97;
  return out;
}

function toWav(samples) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 한 채널
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true);
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

// 종류마다 <audio> 하나. 처음 쓸 때 만든다.
const players = {};
let silentUrl = "";
let unlocked = false;
let fallbackContext = null;

function playerFor(kind) {
  if (players[kind]) return players[kind];
  const sound = SOUNDS[kind];
  if (!sound || typeof Audio === "undefined") return null;
  const samples = render(sound);
  const element = new Audio();
  element.preload = "auto";
  players[kind] = { element, samples, url: toWav(samples), turn: 0 };
  return players[kind];
}

/** 화면을 누른 순간에 부른다. 소리 없는 조각을 한 번 틀어 두면 그 뒤로는 누르지 않아도 소리가 난다. */
export function unlockChime() {
  if (unlocked) return;
  unlocked = true;
  try {
    // <audio> 가 막힐 때 쓸 통로도 누른 순간에 같이 열어 둔다.
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx && !fallbackContext) fallbackContext = new Ctx();
    if (fallbackContext?.state === "suspended") fallbackContext.resume().catch(() => {});
    if (!silentUrl) silentUrl = toWav(new Float32Array(Math.ceil(RATE * 0.05)));
    Object.keys(SOUNDS).forEach((kind) => {
      const player = playerFor(kind);
      if (!player) return;
      const turn = player.turn;
      player.element.src = silentUrl;
      player.element.dataset.kind = "";
      const started = player.element.play();
      if (!started?.then) return;
      started
        .then(() => {
          // 그 사이에 진짜 알림이 시작됐으면 건드리지 않는다.
          if (player.turn === turn) player.element.pause();
        })
        .catch(() => {
          // 진짜 알림이 끼어들어 끊긴 것이면 실패가 아니다.
          if (player.turn === turn) unlocked = false;
        });
    });
  } catch {
    unlocked = false;
  }
}

/** 지금 소리를 낼 수 있는지(한 번이라도 화면을 눌렀는지). */
export function chimeReady() {
  return unlocked;
}

// <audio> 가 막힌 브라우저에서는 같은 소리를 Web Audio 로 낸다.
function playWithContext(player) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!fallbackContext) fallbackContext = new Ctx();
    if (fallbackContext.state === "suspended") fallbackContext.resume().catch(() => {});
    const buffer = fallbackContext.createBuffer(1, player.samples.length, RATE);
    buffer.getChannelData(0).set(player.samples);
    const source = fallbackContext.createBufferSource();
    source.buffer = buffer;
    source.connect(fallbackContext.destination);
    source.start();
  } catch {
    // 소리는 없어도 된다
  }
}

/** kind: "order"(새 주문) · "kitchen"(주방에 넘어온 주문) · "ready"(음식 나옴) */
export function playChime(kind = "order") {
  try {
    const player = playerFor(kind);
    if (!player) return;
    player.turn += 1;
    const { element } = player;
    element.pause();
    // 같은 소리를 다시 틀 때는 처음으로만 돌린다(주소를 다시 넣으면 매번 새로 읽는다).
    if (element.dataset.kind === kind) element.currentTime = 0;
    else {
      element.src = player.url;
      element.dataset.kind = kind;
    }
    element.volume = 1;
    const started = element.play();
    if (started?.then) {
      started
        .then(() => {
          unlocked = true;
        })
        .catch(() => playWithContext(player));
    }
    // 주머니 속 폰은 진동으로도 알린다(되는 기기에서만).
    navigator.vibrate?.(SOUNDS[kind].vibrate);
  } catch {
    // 소리는 없어도 된다
  }
}

if (typeof document !== "undefined") {
  const unlock = () => unlockChime();
  document.addEventListener("pointerdown", unlock, { passive: true });
  document.addEventListener("keydown", unlock);
}
