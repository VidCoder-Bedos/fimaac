// ============================================================================
// FIMAAC — Notes annexes saisies à la main
//
// 15 notes du référentiel ne se déduisent d'aucune balance : dirigeants,
// engagements hors bilan, effectifs, ventilation du CA… Jusqu'ici elles
// restaient « à compléter » à perpétuité, sans écran pour les compléter : la
// liasse ne pouvait donc jamais être déposée complète. Ce module ne calcule
// rien — il transporte une saisie humaine, sans jamais la confondre avec un
// calcul.
// ============================================================================

import type { ManualNote, ManualNoteRow } from "./types";

/** Valeurs saisies, indexées par code de note, pour un dossier et un exercice. */
export function manualNotesFor(
  notes: ManualNote[],
  companyId: string,
  exercise: string,
): Map<string, ManualNote> {
  const out = new Map<string, ManualNote>();
  for (const n of notes) {
    if (n.companyId !== companyId || n.exercise !== exercise) continue;
    out.set(n.code, n);
  }
  return out;
}

/** Nettoie une saisie : montants au franc, libellés conservés, vides préservés. */
export function normalizeRows(rows: { label: string; n: string | number | null; n1: string | number | null }[]): ManualNoteRow[] {
  const toNumber = (v: string | number | null): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[\s\u00A0]/g, "").replace(",", "."));
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  return rows.map((r) => ({ label: r.label.trim(), n: toNumber(r.n), n1: toNumber(r.n1) }));
}

/** Nombre de lignes utiles : une saisie entièrement vide n'a pas à être conservée. */
export function filledRowCount(rows: ManualNoteRow[]): number {
  return rows.filter((r) => r.n !== null || r.n1 !== null).length;
}

/** Une note est complète quand chacune de ses lignes attendues porte une valeur N. */
export function isNoteComplete(rows: ManualNoteRow[]): boolean {
  return rows.length > 0 && rows.every((r) => r.n !== null);
}

/**
 * Fusionne la saisie avec les lignes attendues par le référentiel : une ligne
 * attendue absente de la saisie est rendue vide, jamais 0, et une ligne saisie
 * que le référentiel n'attend pas est conservée (le cabinet peut avoir une
 * ventilation plus fine que le modèle).
 */
export function mergeWithExpected(
  expected: string[],
  saved: ManualNoteRow[] | undefined,
): ManualNoteRow[] {
  const byLabel = new Map((saved ?? []).map((r) => [r.label, r]));
  const rows: ManualNoteRow[] = expected.map((label) => {
    const hit = byLabel.get(label);
    return { label, n: hit?.n ?? null, n1: hit?.n1 ?? null };
  });
  for (const r of saved ?? []) {
    if (!expected.includes(r.label)) rows.push({ label: r.label, n: r.n, n1: r.n1 });
  }
  return rows;
}

/** Somme des lignes saisies — `null` si aucune valeur n'existe (pas 0). */
export function totalOf(rows: ManualNoteRow[], period: "n" | "n1"): number | null {
  const values = rows.map((r) => r[period]).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0);
}

/** Message de contrôle : ce qui reste à saisir, en clair. */
export function describeCompletion(notes: { code: string; rows: ManualNoteRow[] }[]): string {
  if (notes.length === 0) return "Aucune note à saisie manuelle.";
  const complete = notes.filter((n) => isNoteComplete(n.rows));
  const remaining = notes.filter((n) => !isNoteComplete(n.rows));
  if (remaining.length === 0) {
    return `${complete.length}/${notes.length} note(s) manuelle(s) saisies : la liasse peut être déposée complète.`;
  }
  return `${complete.length}/${notes.length} note(s) manuelle(s) saisies · restent ${remaining.map((n) => n.code.replace("NOTE_", "")).join(", ")}.`;
}
