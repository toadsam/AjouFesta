// 사주 소개팅 첫 화면 배너. 밤하늘 그림이 손가락·폰 기울기를 따라 살짝 움직이고, 치토가 오른쪽 아래에서 손을 흔든다.
// 그림은 /images/saju/ajou-night.webp(아주대 밤 풍경)가 있으면 그걸, 없으면 달·오행 원 그림을 쓴다.
// 치토도 /images/saju/chito-dosa.png 가 있으면 그걸, 없으면 공식 포즈(chito-wave.png)를 그대로 쓴다.
import { useEffect, useRef } from "react";

export default function SajuHero({ onChitoClick }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    let reduced = false;
    try {
      reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reduced = false;
    }
    if (reduced) return undefined;

    let frame = 0;
    const apply = (x, y) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        node.style.setProperty("--tx", `${Math.max(-1, Math.min(1, x)).toFixed(3)}`);
        node.style.setProperty("--ty", `${Math.max(-1, Math.min(1, y)).toFixed(3)}`);
      });
    };
    const onPointer = (event) => {
      const rect = node.getBoundingClientRect();
      apply(((event.clientX - rect.left) / rect.width) * 2 - 1, ((event.clientY - rect.top) / rect.height) * 2 - 1);
    };
    const onLeave = () => apply(0, 0);
    const onTilt = (event) => {
      if (event.gamma == null || event.beta == null) return;
      apply(event.gamma / 25, (event.beta - 45) / 30);
    };
    node.addEventListener("pointermove", onPointer);
    node.addEventListener("pointerleave", onLeave);
    // 권한을 따로 물어야 하는 기기(iOS)에서는 기울기를 쓰지 않는다.
    const canTilt = typeof window.DeviceOrientationEvent !== "undefined" && typeof window.DeviceOrientationEvent.requestPermission !== "function";
    if (canTilt) window.addEventListener("deviceorientation", onTilt);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("pointermove", onPointer);
      node.removeEventListener("pointerleave", onLeave);
      if (canTilt) window.removeEventListener("deviceorientation", onTilt);
    };
  }, []);

  return (
    <section ref={ref} className="ai-match-hero-card saju-hero saju-hero--live">
      <img
        className="saju-hero__bg"
        src="/images/saju/ajou-night.webp"
        alt=""
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = "/images/saju/hero.webp";
        }}
      />
      <div className="saju-hero__shade" aria-hidden="true" />
      <div className="ai-match-hero-copy">
        <p>아주대학교 가을축제 · 바람</p>
        <h2>AI 사주 소개팅</h2>
        <span>아주 좋은 인연은 사주가 먼저 알아봐요. 궁합을 보고, 부스에서 얼굴을 가린 채 만나요.</span>
        <em className="saju-hero__quote">“좋은 인연은, 언제나 이유가 있더라.”</em>
      </div>
      <button type="button" className="saju-hero__chito" onClick={onChitoClick} aria-label="치토 도사에게 오늘의 연애운 뽑으러 가기">
        <img
          src="/images/saju/chito-dosa.png"
          alt=""
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = "/images/chito-wave.png";
          }}
        />
        <span>오늘의 운 ›</span>
      </button>
      <span className="saju-hero__seal" aria-hidden="true">緣</span>
    </section>
  );
}
