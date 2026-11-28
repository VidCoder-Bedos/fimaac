// ============================================================================
// FIMAAC — Notes annexes de la liasse
//
// Constat d'audit : `src/lib/notes.ts` contient 38 modules de notes SYSCOHADA
// (calcul complet, règle « une valeur non déterminée vaut null, jamais 0 ») et
// **aucun écran ne les appelait**. La liasse remise au client s'arrêtait donc au
// bilan, au compte de résultat et, depuis peu, au TAFIRE.
//
// Ce module branche ces notes sur les balances N / N-1, les trie, et dit
// exactement ce qui reste à saisir à la main.
// ============================================================================
import { computeAllNotes, NOTE_MODULES, MANUAL_NOTE_CODES } from "./notes";
import { createProdContext } from "./production/context";
import type { NoteResult } from "./production/types";
import type { BalanceRow } from "./liasse";
import type { Account } from "./types";

export interface AnnexNote {
  code: string;
  title: string;
  status: NoteResult["status"];
  totalN: number | null;
  totalN1: number | null;
  variation: number | null;
  rows: { label: string; ref?: string; n: number | null; n1: number | null; variation: number | null }[];
  missingInfo: string[];
  /** Note dont le calcul est possible mais incomplet (saisie requise). */
  manual: boolean;
}

export interface AnnexControl {
  id: string;
  label: string;
  level: "ok" | "warning" | "blocking";
  detail: string;
}

export interface NotesAnnex {
  notes: AnnexNote[];
  manualNotes: AnnexNote[];
  computedCount: number;
  manualCount: number;
  registryCount: number;
  /** Cellules restées indéterminées (jamais remplacées par 0). */
  undeterminedCells: number;
  controls: AnnexControl[];
  blockingCount: number;
  warningCount: number;
}

/** Ordre du référentiel : numéro de note, puis suffixe A/B/C. */
const ORDER = (code: string) => {
  const m = code.match(/\d+/);
  if (!m) return 9999;
  const suffix = /A$/.test(code) ? 1 : /B$/.test(code) ? 2 : /C$/.test(code) ? 3 : 0;
  return Number(m[0]) * 10 + suffix;
};

/**
 * Calcule les notes annexes applicables au dossier.
 * `n1` absent n'est pas comblé : les variations restent nulles et sont signalées.
 */
export function buildNotesAnnex(input: {
  n: BalanceRow[];
  n1?: BalanceRow[];
  accounts?: Account[];
  companyName?: string;
  exercise?: string;
}): NotesAnnex {
  const hasN1 = Boolean(input.n1 && input.n1.length > 0);
  const ctx = createProdContext({
    balances: { n: input.n, n1: input.n1 ?? [] },
    accounts: input.accounts ?? [],
    companyName: input.companyName ?? "",
    exercise: input.exercise ?? "",
  });
  const results = computeAllNotes(ctx);
  const titleOf = new Map(NOTE_MODULES.map((m) => [m.code, m.title]));

  const all: AnnexNote[] = [...results.values()]
    .map((r) => ({
      code: r.code,
      title: titleOf.get(r.code) ?? r.code,
      status: r.status,
      totalN: r.totalN,
      totalN1: r.totalN1,
      variation: r.totalN !== null && r.totalN1 !== null ? r.totalN - r.totalN1 : null,
      rows: r.rows.map((row) => ({
        label: row.label,
        ref: row.ref,
        n: row.n,
        n1: row.n1,
        variation: row.variation ?? (row.n !== null && row.n1 !== null ? row.n - row.n1 : null),
      })),
      missingInfo: r.missingInfo,
      manual: r.status === "to_confirm" || MANUAL_NOTE_CODES.has(r.code),
    }))
    .sort((a, b) => ORDER(a.code) - ORDER(b.code));

  const notes = all.filter((n) => !n.manual);
  const manualNotes = all.filter((n) => n.manual);
  const undeterminedCells = all.reduce(
    (count, n) => count + n.rows.reduce((c, row) => c + (row.n === null ? 1 : 0) + (row.n1 === null && hasN1 ? 1 : 0), 0),
    0,
  );

  const controls: AnnexControl[] = [
    {
      id: "couverture",
      label: "Couverture du référentiel",
      level: "ok",
      detail: `${all.length} note(s) produite(s) sur ${NOTE_MODULES.length} au référentiel : ${notes.length} calculée(s) depuis les balances, ${manualNotes.length} à compléter à la main.`,
    },
    {
      id: "manuelles",
      label: "Notes à saisie manuelle",
      level: manualNotes.length === 0 ? "ok" : "warning",
      detail: manualNotes.length === 0
        ? "Aucune note en attente."
        : `${manualNotes.length} note(s) ne peuvent pas être déduites d'une balance : ${manualNotes.map((n) => n.code).join(", ")}. Elles ne sont pas remplies de zéros.`,
    },
    {
      id: "indetermine",
      label: "Valeurs indéterminées",
      level: undeterminedCells === 0 ? "ok" : "warning",
      detail: undeterminedCells === 0
        ? "Aucune cellule vide : tout est soit calculé, soit explicitement absent."
        : `${undeterminedCells} cellule(s) restent indéterminées et s'impriment « — » : la règle du référentiel interdit de les remplacer par 0.`,
    },
    {
      id: "n1",
      label: "Balance N-1 pour les variations",
      level: hasN1 ? "ok" : "warning",
      detail: hasN1
        ? "Les colonnes N-1 et variation sont renseignées."
        : "Balance N-1 absente : la colonne N-1 et les variations restent vides, aucune extrapolation.",
    },
    {
      id: "totaux",
      label: "Lecture des totaux de notes",
      level: "ok",
      detail: "Un total de note est la somme de ses lignes, pas un poste du bilan : deux notes ne s'additionnent pas entre elles.",
    },
  ];

  return {
    notes,
    manualNotes,
    computedCount: notes.length,
    manualCount: manualNotes.length,
    registryCount: NOTE_MODULES.length,
    undeterminedCells,
    controls,
    blockingCount: controls.filter((c) => c.level === "blocking").length,
    warningCount: controls.filter((c) => c.level === "warning").length,
  };
}
