// ============================================================================
// FIMAAC — Contraste des couleurs, mesuré et non supposé (P31)
//
// Constat d'audit (§D, point 12) : le contraste n'avait jamais été audité. Il
// suffisait de calculer pour voir : `text-slate-500` (327 occurrences) donne
// **2,85:1** sur blanc, très en dessous du seuil AA de 4,5:1 pour du texte
// courant — c'est-à-dire que le libellé secondaire d'un tableau comptable était
// plus difficile à lire qu'un texte gris de site vitrine.
//
// Ici : la formule WCAG 2.1 (luminance relative), sans dépendance, pour que la
// règle soit vérifiable en test plutôt qu'affirmée en revue de design.
// ============================================================================

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Palette restreinte aux teintes réellement employées dans l'interface. */
export const PALETTE: Record<string, string> = {
  white: "#ffffff",
  "slate-50": "#f8fafc",
  "slate-100": "#f1f5f9",
  "slate-200": "#e2e8f0",
  "slate-300": "#cbd5e1",
  "slate-400": "#94a3b8",
  "slate-500": "#64748b",
  "slate-600": "#475569",
  "slate-700": "#334155",
  "slate-800": "#1e293b",
  "slate-900": "#0f172a",
  "indigo-400": "#818cf8",
  "indigo-500": "#6366f1",
  "indigo-600": "#4f46e5",
  "indigo-700": "#4338ca",
  "violet-600": "#7c3aed",
  "emerald-400": "#34d399",
  "emerald-500": "#10b981",
  "emerald-600": "#059669",
  "emerald-700": "#047857",
  "amber-50": "#fffbeb",
  "amber-400": "#fbbf24",
  "amber-500": "#f59e0b",
  "amber-600": "#d97706",
  "amber-700": "#b45309",
  "amber-800": "#92400e",
  "rose-50": "#fff1f2",
  "rose-400": "#fb7185",
  "rose-500": "#f43f5e",
  "rose-600": "#e11d48",
  "rose-700": "#be123c",
  "sky-50": "#f0f9ff",
  "sky-500": "#0ea5e9",
  "sky-600": "#0284c7",
  "sky-700": "#0369a1",
  "teal-600": "#0d9488",
};

/** Parse `#rgb`, `#rrggbb` ou `#rrggbbaa` (alpha ignoré : on mesure sur fond opaque). */
export function hexToRgb(hex: string): Rgb {
  const clean = hex.trim().replace(/^#/, "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  if (!/^[0-9a-fA-F]{6}/.test(full)) throw new Error(`Couleur illisible : ${hex}`);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** Luminance relative WCAG 2.1 (canal linéarisé, pondération 0.2126 / 0.7152 / 0.0722). */
export function relativeLuminance(color: Rgb | string): number {
  const { r, g, b } = typeof color === "string" ? hexToRgb(color) : color;
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Rapport de contraste, de 1:1 (identique) à 21:1 (noir sur blanc). */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

export type WcagLevel = "fail" | "AA" | "AAA";
export type TextSize = "normal" | "large";

/**
 * Seuils WCAG 2.1 : 4,5:1 pour le texte courant (3:1 pour le grand texte),
 * 7:1 et 4,5:1 pour le niveau AAA. Le grand texte est ≥ 18,66 px gras ou ≥ 24 px.
 */
export function wcagLevel(ratio: number, size: TextSize = "normal"): WcagLevel {
  const aa = size === "large" ? 3 : 4.5;
  const aaa = size === "large" ? 4.5 : 7;
  if (ratio >= aaa) return "AAA";
  if (ratio >= aa) return "AA";
  return "fail";
}

/** Contraste minimal exigé pour un composant d'interface (bordures, icônes actives). */
export const NON_TEXT_MIN = 3;

/** Résumé lisible d'un couple, prêt à être affiché dans un audit. */
export function describeContrast(foreground: string, background: string, size: TextSize = "normal"): string {
  const ratio = contrastRatio(foreground, background);
  const level = wcagLevel(ratio, size);
  return `${foreground} sur ${background} : ${ratio.toFixed(2)}:1 — ${level === "fail" ? "sous le seuil AA" : level}`;
}

/* ----------------------------------------------------------------------------
 * P32 — L'encre se choisit par la mesure, pas par l'habitude.
 *
 * P31 avait corrigé les classes de texte sur fond clair. Restaient les fonds
 * *pleins* : pastilles, puces de calendrier, barres de composition — et les
 * couleurs venues des données (`avatarColor`, `logoColor`, teintes de séries).
 * Le blanc y était posé par convention : il donne 2,15:1 sur `amber-500` et
 * 2,54:1 sur `emerald-500`, c'est-à-dire un texte qu'on ne lit pas.
 *
 * Sur ces fonds, aucune teinte ne peut être décidée à l'avance : c'est le fond
 * qui décide. On mesure les deux encres possibles et on garde la meilleure.
 * -------------------------------------------------------------------------- */

/** Encre claire et encre sombre du produit — les deux seules candidates. */
export const INK_LIGHT = "#ffffff";
export const INK_DARK = "#0f172a";

/** Meilleure encre (blanche ou ardoise) sur `background`, mesurée. Égalité → blanc. */
export function bestTextOn(background: string): string {
  return contrastRatio(INK_DARK, background) > contrastRatio(INK_LIGHT, background) ? INK_DARK : INK_LIGHT;
}

/** Le contraste obtenu par `bestTextOn` — utile pour dire si même le meilleur échoue. */
export function bestTextRatio(background: string): number {
  return Math.max(contrastRatio(INK_LIGHT, background), contrastRatio(INK_DARK, background));
}
