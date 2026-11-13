const colorMap = {
  여유: "bg-cyan-400/20 text-cyan-200 border border-cyan-300/50",
  보통: "bg-sky-500/20 text-sky-200 border border-sky-300/50",
  혼잡: "bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-300/50",
  매우혼잡: "bg-rose-500/25 text-rose-200 border border-rose-300/60",
};

function normalizeLevel(level) {
  return level;
}

export default function CongestionBadge({ level }) {
  const normalized = normalizeLevel(level);
  const className =
    colorMap[normalized] ||
    "bg-slate-700/30 text-slate-200 border border-slate-400/40";

  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap ${className}`}
    >
      <span aria-hidden>*</span>
      {normalized}
    </span>
  );
}
