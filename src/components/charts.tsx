// ============================================================================
// FIMAAC — Bibliothèque de graphiques SVG (sans dépendance externe)
// Tous les graphiques sont responsive (viewBox + w-full) et lisibles.
// ============================================================================
import React from "react";

/** Formateur monnaie compact par défaut. */
const fmt = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + " Md";
  if (a >= 1_000_000) return (n / 1_000_000).toFixed(1) + " M";
  if (a >= 1_000) return (n / 1_000).toFixed(0) + " k";
  return String(Math.round(n));
};
export const fmtMoney = fmt;

/* ------------------------------------------------------------------ */
/* Sparkline — mini-tendance inline pour les tuiles KPI                */
/* ------------------------------------------------------------------ */
export function Sparkline({ data, color = "#6366f1", height = 32, fill = true }: { data: number[]; color?: string; height?: number; fill?: boolean }) {
  if (data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 100;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, 100 - ((v - min) / range) * 88 - 6]);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const gid = React.useId().replace(/[:]/g, "");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height }}>
      {fill && (
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {fill && <path d={`${line} L100,100 L0,100 Z`} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* TrendDelta — variation % avec flèche directionnelle                 */
/* ------------------------------------------------------------------ */
export function TrendDelta({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  if (!previous) return <span className="text-xs text-slate-500">—</span>;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const up = pct >= 0;
  // invert : une hausse est défavorable (ex. charges)
  const good = invert ? !up : up;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${good ? "text-emerald-700" : "text-rose-700"}`}>
      <svg width="10" height="10" viewBox="0 0 10 10" className={up ? "" : "rotate-180"}>
        <path d="M5 2L9 7H1L5 2Z" fill="currentColor" />
      </svg>
      {Math.abs(pct).toFixed(1)} %
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* AreaTrend — courbe + aire avec grille, points et valeurs            */
/* ------------------------------------------------------------------ */
export function AreaTrend({
  series, labels, color = "#6366f1", height = 220, yFormat = fmt, showValues = false,
}: { series: { name: string; data: number[]; color?: string }[]; labels: string[]; color?: string; height?: number; yFormat?: (n: number) => string; showValues?: boolean }) {
  const W = 700, H = 300, PAD = { l: 60, r: 16, t: 18, b: 32 };
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const all = series.flatMap((s) => s.data);
  const max = Math.max(...all, 1) * 1.1;
  const min = Math.min(...all, 0);
  const range = max - min || 1;
  const x = (i: number) => PAD.l + (i / Math.max(1, labels.length - 1)) * iw;
  const y = (v: number) => PAD.t + ih - ((v - min) / range) * ih;
  const ticks = 4;
  const gridVals = Array.from({ length: ticks + 1 }, (_, i) => min + (range / ticks) * i);
  const gid = React.useId().replace(/[:]/g, "");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: height * 1.4 }}>
      <defs>
        {series.map((s, i) => (
          <linearGradient key={i} id={`${gid}-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color || color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={s.color || color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {/* Grille */}
      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray={i === 0 ? "" : "4 4"} />
          <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#64748b">{yFormat(v)}</text>
        </g>
      ))}
      {/* Séries */}
      {series.map((s, si) => {
        const pts = s.data.map((v, i) => [x(i), y(v)]);
        const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
        return (
          <g key={si}>
            <path d={`${line} L${x(s.data.length - 1)},${y(min)} L${x(0)},${y(min)} Z`} fill={`url(#${gid}-${si})`} />
            <path d={line} fill="none" stroke={s.color || color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {s.data.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={showValues ? 4 : 3} fill="#fff" stroke={s.color || color} strokeWidth="2" />
            ))}
            {showValues && s.data.map((v, i) => (
              <text key={i} x={x(i)} y={y(v) - 10} textAnchor="middle" fontSize="9" fontWeight="600" fill="#334155">{yFormat(v)}</text>
            ))}
          </g>
        );
      })}
      {/* Axe X */}
      {labels.map((l, i) => (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#64748b">{l}</text>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* GroupedBars — barres verticales multi-séries                        */
/* ------------------------------------------------------------------ */
export function GroupedBars({
  labels, series, height = 220, yFormat = fmt,
}: { labels: string[]; series: { name: string; data: number[]; color: string }[]; height?: number; yFormat?: (n: number) => string }) {
  const W = 700, H = 300, PAD = { l: 60, r: 16, t: 18, b: 42 };
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const all = series.flatMap((s) => s.data);
  const max = Math.max(...all, 1) * 1.08;
  const groupW = iw / Math.max(1, labels.length);
  const barW = Math.min(22, (groupW - 8) / series.length);
  const ticks = 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: height * 1.4 }}>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = (max / ticks) * i;
        const yy = PAD.t + ih - (v / max) * ih;
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yy} y2={yy} stroke="#e2e8f0" strokeWidth="1" strokeDasharray={i === 0 ? "" : "4 4"} />
            <text x={PAD.l - 6} y={yy + 4} textAnchor="end" fontSize="10" fill="#64748b">{yFormat(v)}</text>
          </g>
        );
      })}
      {labels.map((l, gi) => {
        const gx = PAD.l + gi * groupW;
        return (
          <g key={gi}>
            {series.map((s, si) => {
              const v = s.data[gi] || 0;
              const bh = (v / max) * ih;
              const bx = gx + (groupW - series.length * barW) / 2 + si * barW;
              return (
                <g key={si}>
                  <rect x={bx} y={PAD.t + ih - bh} width={barW - 2} height={Math.max(0, bh)} rx="3" fill={s.color} />
                </g>
              );
            })}
            <text x={gx + groupW / 2} y={H - 22} textAnchor="middle" fontSize="10" fill="#64748b">{l}</text>
          </g>
        );
      })}
      {/* Légende */}
      {series.map((s, i) => (
        <g key={i} transform={`translate(${PAD.l + i * 130}, ${H - 6})`}>
          <rect width="10" height="10" rx="2" fill={s.color} />
          <text x="14" y="9" fontSize="10" fill="#475569">{s.name}</text>
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* HBars — barres horizontales triées avec valeurs                     */
/* ------------------------------------------------------------------ */
export function HBars({
  items, color = "#6366f1", formatter = fmt, max: maxProp,
}: { items: { label: string; value: number }[]; color?: string; formatter?: (n: number) => string; max?: number }) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const max = maxProp ?? Math.max(...sorted.map((i) => Math.abs(i.value)), 1);
  if (sorted.length === 0) return <p className="py-6 text-center text-sm text-slate-500">Aucune donnée</p>;
  return (
    <div className="space-y-2">
      {sorted.map((it, i) => {
        const pct = (Math.abs(it.value) / max) * 100;
        const negative = it.value < 0;
        return (
          <div key={i}>
            <div className="mb-0.5 flex items-baseline justify-between text-xs">
              <span className="truncate font-medium text-slate-600">{it.label}</span>
              <span className={`shrink-0 font-bold tabular-nums ${negative ? "text-rose-700" : "text-slate-800"}`}>{formatter(it.value)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, pct)}%`, background: negative ? "linear-gradient(to right,#f43f5e,#fb7185)" : `linear-gradient(to right,${color},${color}bb)` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gauge — jauge semi-circulaire avec seuils                           */
/* ------------------------------------------------------------------ */
export function Gauge({ value, size = 180, label, sublabel, color }: { value: number; size?: number; label?: string; sublabel?: string; color?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const stroke = size * 0.09;
  const r = (size - stroke) / 2;
  const cx = size / 2, cy = size / 2;
  // Arc de 180° (de 180° à 0°)
  const startAngle = Math.PI;
  const endAngle = 0;
  const valAngle = startAngle - (clamped / 100) * Math.PI;
  const arcPath = (from: number, to: number) => {
    const x1 = cx + r * Math.cos(from), y1 = cy - r * Math.sin(from);
    const x2 = cx + r * Math.cos(to), y2 = cy - r * Math.sin(to);
    return `M${x1},${y1} A${r},${r} 0 ${Math.abs(from - to) > Math.PI ? 1 : 0} ${from > to ? 1 : 0} ${x2},${y2}`;
  };
  const c = color ?? (clamped >= 80 ? "#059669" : clamped >= 60 ? "#d97706" : "#ef4444");
  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size / 2 + 12} viewBox={`0 0 ${size} ${size / 2 + 12}`}>
        <path d={arcPath(startAngle, endAngle)} fill="none" stroke="#e2e8f0" strokeWidth={stroke} strokeLinecap="round" />
        <path d={arcPath(startAngle, valAngle)} fill="none" stroke={c} strokeWidth={stroke} strokeLinecap="round" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={size * 0.2} fontWeight="800" fill="#0f172a">{label ?? `${Math.round(clamped)}`}</text>
        {sublabel && <text x={cx} y={cy + 14} textAnchor="middle" fontSize={size * 0.075} fill="#64748b">{sublabel}</text>}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* RadialRings — anneaux concentriques pour scores multi-axes          */
/* ------------------------------------------------------------------ */
export function RadialRings({ rings, size = 160 }: { rings: { label: string; value: number; color: string }[]; size?: number }) {
  const stroke = size * 0.075;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {rings.map((r, i) => {
          const rr = (size - stroke) / 2 - i * (stroke + 4);
          const c = 2 * Math.PI * rr;
          const offset = c - (Math.max(0, Math.min(100, r.value)) / 100) * c;
          return (
            <g key={i}>
              <circle cx={size / 2} cy={size / 2} r={rr} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
              <circle cx={size / 2} cy={size / 2} r={rr} fill="none" stroke={r.color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold text-slate-900">{Math.round(rings[0]?.value ?? 0)}</span>
        <span className="text-[10px] font-medium uppercase text-slate-500">{rings[0]?.label}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ScatterPlot — nuage de points avec axes et quadrants                */
/* ------------------------------------------------------------------ */
export function ScatterPlot({
  points, xLabel, yLabel, height = 220, color = "#6366f1",
}: { points: { x: number; y: number; label: string; size?: number }[]; xLabel: string; yLabel: string; height?: number; color?: string }) {
  const W = 500, H = 300, PAD = { l: 56, r: 20, t: 16, b: 36 };
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  if (points.length === 0) return <p className="py-8 text-center text-sm text-slate-500">Aucune donnée</p>;
  const maxX = Math.max(...points.map((p) => p.x), 1) * 1.15;
  const maxY = Math.max(...points.map((p) => Math.abs(p.y)), 1) * 1.15;
  const px = (v: number) => PAD.l + (v / maxX) * iw;
  const py = (v: number) => PAD.t + ih / 2 - (v / maxY) * (ih / 2);
  const zeroY = py(0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: height * 1.4 }}>
      <line x1={PAD.l} x2={W - PAD.r} y1={zeroY} y2={zeroY} stroke="#cbd5e1" strokeWidth="1.5" />
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + ih} stroke="#e2e8f0" strokeWidth="1" />
      <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ih} y2={PAD.t + ih} stroke="#e2e8f0" strokeWidth="1" />
      <text x={PAD.l - 6} y={PAD.t + 8} textAnchor="end" fontSize="9" fill="#64748b">{fmt(maxY)}</text>
      <text x={PAD.l - 6} y={zeroY - 4} textAnchor="end" fontSize="9" fill="#64748b">0</text>
      <text x={PAD.l - 6} y={PAD.t + ih} textAnchor="end" fontSize="9" fill="#64748b">{fmt(-maxY)}</text>
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={px(p.x)} cy={py(p.y)} r={p.size ?? 10} fill={p.y >= 0 ? color : "#f43f5e"} fillOpacity="0.75" stroke="#fff" strokeWidth="2" />
          <text x={px(p.x)} y={py(p.y) - (p.size ?? 10) - 6} textAnchor="middle" fontSize="9" fontWeight="600" fill="#334155">{p.label}</text>
        </g>
      ))}
      <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize="10" fill="#64748b">{xLabel} →</text>
      <text x={PAD.l + 4} y={PAD.t + 10} fontSize="10" fill="#64748b">↑ {yLabel}</text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Waterfall — pont CA → charges → résultat                            */
/* ------------------------------------------------------------------ */
export function Waterfall({ steps, height = 220, formatter = fmt }: { steps: { label: string; value: number; type: "start" | "minus" | "total" }[]; height?: number; formatter?: (n: number) => string }) {
  const W = 700, H = 300, PAD = { l: 60, r: 16, t: 18, b: 46 };
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  let running = 0;
  const bars = steps.map((s) => {
    if (s.type === "start") { running = s.value; return { ...s, from: 0, to: s.value }; }
    if (s.type === "total") return { ...s, from: 0, to: running };
    const to = running + s.value;
    const bar = { ...s, from: running, to };
    running = to;
    return bar;
  });
  const allVals = bars.flatMap((b) => [b.from, b.to]);
  const max = Math.max(...allVals, 1) * 1.08;
  const min = Math.min(...allVals, 0);
  const range = max - min || 1;
  const bw = Math.min(80, iw / bars.length - 12);
  const y = (v: number) => PAD.t + ih - ((v - min) / range) * ih;
  const ticks = 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: height * 1.4 }}>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = min + (range / ticks) * i;
        const yy = y(v);
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yy} y2={yy} stroke="#e2e8f0" strokeWidth="1" strokeDasharray={i === 0 ? "" : "4 4"} />
            <text x={PAD.l - 6} y={yy + 4} textAnchor="end" fontSize="10" fill="#64748b">{formatter(v)}</text>
          </g>
        );
      })}
      {bars.map((b, i) => {
        const x = PAD.l + i * (iw / bars.length) + (iw / bars.length - bw) / 2;
        const top = y(Math.max(b.from, b.to));
        const h = Math.max(2, Math.abs(y(b.from) - y(b.to)));
        const c = b.type === "start" ? "#6366f1" : b.type === "total" ? (b.to >= 0 ? "#059669" : "#ef4444") : b.value >= 0 ? "#059669" : "#f43f5e";
        return (
          <g key={i}>
            {i > 0 && b.type !== "total" && (
              <line x1={x - (iw / bars.length) + bw} x2={x} y1={y(bars[i - 1].to)} y2={y(bars[i - 1].to)} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
            )}
            <rect x={x} y={top} width={bw} height={h} rx="4" fill={c} fillOpacity={b.type === "minus" ? 0.85 : 1} />
            <text x={x + bw / 2} y={top - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill="#334155">{formatter(b.type === "total" ? b.to : b.value)}</text>
            <text x={x + bw / 2} y={H - 24} textAnchor="middle" fontSize="10" fill="#64748b">{b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* StackedComposition — barre horizontale de composition               */
/* ------------------------------------------------------------------ */
export function StackedComposition({ segments, height = 28 }: { segments: { label: string; value: number; color: string }[]; height?: number }) {
  const total = segments.reduce((s, x) => s + Math.abs(x.value), 0);
  if (total === 0) return <div className="rounded-lg bg-slate-100" style={{ height }} />;
  return (
    <div>
      <div className="flex overflow-hidden rounded-full" style={{ height }}>
        {segments.map((s, i) => (
          <div key={i} className="flex items-center justify-center transition-all" style={{ width: `${(Math.abs(s.value) / total) * 100}%`, background: s.color }} title={`${s.label} : ${fmt(s.value)}`}>
            {(Math.abs(s.value) / total) > 0.1 && <span className="rounded bg-white/95 px-1 text-[10px] font-bold text-slate-900 shadow-sm">{((Math.abs(s.value) / total) * 100).toFixed(0)}%</span>}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MiniBars — petites barres verticales inline                         */
/* ------------------------------------------------------------------ */
export function MiniBars({ data, color = "#6366f1", height = 28 }: { data: number[]; color?: string; height?: number }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {data.map((v, i) => (
        <div key={i} className="flex-1 rounded-t" style={{ height: `${Math.max(4, (v / max) * 100)}%`, background: color, opacity: 0.3 + (0.7 * v) / max }} />
      ))}
    </div>
  );
}
