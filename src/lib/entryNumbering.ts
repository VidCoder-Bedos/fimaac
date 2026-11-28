// ============================================================================
// FIMAAC — Numérotation des pièces comptables
//
// Constat d'audit : le numéro d'écriture valait `nombre d'écritures du journal
// + 1`. Deux conséquences, toutes deux silencieuses :
//   • supprimer une écriture rend son numéro réutilisable → doublon ;
//   • importer un historique rend le compteur incapable de reprendre la suite.
// Un numéro de pièce réutilisé casse la piste d'audit et fait rejeter un FEC.
//
// Règle retenue : la séquence reprend **après le plus grand numéro existant**
// du journal, et l'on vérifie l'unicité avant de rendre la main.
// ============================================================================
import type { JournalEntry } from "./types";

export interface ParsedEntryNumber {
  prefix: string;
  sequence: number | null;
  /** Suffixe d'extourne : "C" pour une contre-passation. */
  suffix: string;
  width: number;
}

/**
 * Décompose un numéro de pièce.
 * "ACH-0104" → { prefix: "ACH", sequence: 104, suffix: "", width: 4 }
 * "ACH-0104-C" → { …, suffix: "C" }
 * "LIBRE" → { prefix: "LIBRE", sequence: null, suffix: "", width: 0 }
 */
export function parseEntryNumber(raw: string): ParsedEntryNumber {
  const value = String(raw ?? "").trim();
  const match = value.match(/^([A-Za-z0-9_]*?)[-_/ ]?(\d+)((?:[-_][A-Za-z0-9]+)*)$/);
  if (!match) return { prefix: value, sequence: null, suffix: "", width: 0 };
  const [, prefix, digits, suffix] = match;
  return {
    prefix: prefix || "",
    sequence: Number.parseInt(digits, 10),
    suffix: suffix || "",
    width: digits.length,
  };
}

/** Séquence maximale d'un journal, toutes écritures confondues (extournes exclues). */
export function maxSequence(numbers: string[], prefix?: string): number {
  let max = 0;
  for (const n of numbers) {
    const p = parseEntryNumber(n);
    if (p.sequence === null) continue;
    if (prefix !== undefined && p.prefix !== prefix) continue;
    if (p.suffix) continue; // une extourne ne consomme pas de numéro
    if (p.sequence > max) max = p.sequence;
  }
  return max;
}

/**
 * Numéro suivant : `PREFIX-0001`, en repartant du maximum existant et en
 * sautant les numéros déjà pris.
 */
export function nextEntryNumber(existing: string[], prefix: string, width = 4): string {
  const taken = new Set(existing.map((n) => String(n).trim().toUpperCase()));
  let seq = maxSequence(existing, prefix) + 1;
  let candidate = `${prefix}-${String(seq).padStart(width, "0")}`;
  while (taken.has(candidate.toUpperCase())) {
    seq += 1;
    candidate = `${prefix}-${String(seq).padStart(width, "0")}`;
  }
  return candidate;
}

export interface NumberingAudit {
  ok: boolean;
  checked: number;
  duplicates: { number: string; count: number; entries: string[] }[];
  gaps: { prefix: string; year: string; missing: number[] }[];
  malformed: string[];
  counters: { prefix: string; year: string; from: number; to: number; count: number }[];
}

/**
 * Contrôle d'intégrité de la numérotation, journal par journal et année par
 * année : doublons, trous, numéros illisibles, et l'étendue couverte.
 */
export function auditNumbering(
  entries: JournalEntry[],
  journals: { id: string; code: string }[] = [],
): NumberingAudit {
  const codeOf = new Map(journals.map((j) => [j.id, j.code]));
  const byNumber = new Map<string, string[]>();
  const byGroup = new Map<string, number[]>();
  const malformed: string[] = [];

  for (const e of entries) {
    const number = String(e.number ?? "").trim();
    if (!number) {
      malformed.push(e.id);
      continue;
    }
    const parsed = parseEntryNumber(number);
    if (parsed.sequence === null) {
      malformed.push(number);
      continue;
    }
    const key = number.toUpperCase();
    byNumber.set(key, [...(byNumber.get(key) ?? []), e.number]);

    // Un trou s'apprécie à l'intérieur d'un journal et d'une année.
    const prefix = parsed.prefix || codeOf.get(e.journalId) || "??";
    const year = String(e.date ?? "").slice(0, 4) || "????";
    const group = `${prefix}|${year}`;
    if (!parsed.suffix) byGroup.set(group, [...(byGroup.get(group) ?? []), parsed.sequence]);
  }

  const duplicates = [...byNumber.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([number, list]) => ({ number, count: list.length, entries: list }));

  const gaps: NumberingAudit["gaps"] = [];
  const counters: NumberingAudit["counters"] = [];
  for (const [group, seqs] of byGroup) {
    const [prefix, year] = group.split("|");
    const sorted = [...new Set(seqs)].sort((a, b) => a - b);
    const from = sorted[0];
    const to = sorted[sorted.length - 1];
    counters.push({ prefix, year, from, to, count: seqs.length });
    const missing: number[] = [];
    for (let n = from; n <= to; n++) if (!seqs.includes(n)) missing.push(n);
    if (missing.length > 0) gaps.push({ prefix, year, missing });
  }

  return {
    ok: duplicates.length === 0 && malformed.length === 0,
    checked: entries.length,
    duplicates,
    gaps: gaps.sort((a, b) => a.prefix.localeCompare(b.prefix) || a.year.localeCompare(b.year)),
    malformed,
    counters: counters.sort((a, b) => a.prefix.localeCompare(b.prefix) || a.year.localeCompare(b.year)),
  };
}

export const numberLabel = (n: number) => String(n).padStart(4, "0");
