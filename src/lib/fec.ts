// ============================================================================
// FIMAAC — Fichier des Écritures Comptables (FEC)
//
// Constat d'audit : l'export existant comportait 15 colonnes, écrivait les
// montants avec une VIRGULE décimale (ininterprétable par un outil de
// contrôle), laissait les colonnes auxiliaires vides et n'avait aucune devise.
// Il était utilisable en interne, pas remettable.
//
// Ce module construit le fichier au format pipe sur les 18 colonnes de
// référence, avec les contrôles qui vont avec — un export comptable sans
// contrôle est une bombe à retardement.
// ============================================================================
import type { Account, JournalEntry, ThirdParty } from "./types";

/** Colonnes du fichier, dans l'ordre de référence. */
export const FEC_COLUMNS = [
  "JournalCode",
  "JournalLib",
  "EcritureNum",
  "EcritureDate",
  "CompteNum",
  "CompteLib",
  "CompAuxNum",
  "CompAuxLib",
  "PieceRef",
  "PieceDate",
  "EcritureLib",
  "Debit",
  "Credit",
  "EcritureLet",
  "DateLet",
  "ValidDate",
  "Montantdevise",
  "Idevise",
] as const;

export const JOURNAL_LABELS: Record<string, string> = {
  purchases: "Journal des achats",
  sales: "Journal des ventes",
  bank: "Journal de banque",
  cash: "Journal de caisse",
  wages: "Journal de paie",
  misc: "Opérations diverses",
};

export interface FecControl {
  id: string;
  label: string;
  level: "ok" | "warning" | "blocking";
  detail: string;
}

/**
 * Fenêtre de l'exercice exporté. Un FEC se dépose **par exercice** : exporter
 * tout l'historique produisait un fichier contenant N et N-1, refusé au
 * contrôle et impossible à rattacher à une liasse.
 */
export interface FecScope {
  label: string;
  startDate: string; // AAAA-MM-JJ inclus
  endDate: string;   // AAAA-MM-JJ inclus
}

export interface FecReport {
  header: string[];
  rows: string[][];
  /** Contenu complet du fichier, prêt à télécharger. */
  content: string;
  /** Nombre d'écritures et de lignes exportées. */
  entryCount: number;
  lineCount: number;
  totals: { debit: number; credit: number; ecart: number };
  controls: FecControl[];
  blockingCount: number;
  warningCount: number;
  /** Exercice exporté, ou null si le fichier couvre tout l'historique. */
  scope: FecScope | null;
  /** Écritures validées volontairement écartées car hors exercice. */
  excludedCount: number;
}

/** Écritures retenues pour un exercice (dates incluses aux deux bornes). */
export function entriesInScope<T extends { date: string }>(entries: T[], scope: FecScope): T[] {
  return entries.filter((e) => {
    const d = String(e.date ?? "").slice(0, 10);
    return d >= scope.startDate && d <= scope.endDate;
  });
}

/** Construit le périmètre depuis un exercice comptable. */
export function fecScopeFromFiscalYear(fy: { label?: string; startDate: string; endDate: string }): FecScope {
  const label = (fy.label || "").trim() || `${String(fy.startDate).slice(0, 4)}`;
  return { label, startDate: String(fy.startDate).slice(0, 10), endDate: String(fy.endDate).slice(0, 10) };
}

/** Date comptable au format AAAAMMJJ ; vide si la date est inexploitable. */
export function fecDate(value: unknown): string {
  const s = String(value ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return s.replace(/-/g, "");
}

/**
 * Montant FEC : point décimal, deux décimales, jamais de séparateur de
 * milliers ni d'espace. C'est le point qui rendait l'ancien export illisible
 * pour un outil de contrôle.
 */
export function fecAmount(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return Math.abs(n).toFixed(2);
}

const clean = (value: unknown): string =>
  String(value ?? "")
    .replace(/[|\r\n\t]/g, " ")
    .trim();

/**
 * Construit le FEC et ses contrôles.
 * Seules les écritures **validées** sont exportées : un brouillon n'est pas
 * une écriture comptable opposable.
 */
export function buildFec(
  entries: JournalEntry[],
  journals: { id: string; code: string; type: string }[],
  accounts: Account[],
  tiers: ThirdParty[] = [],
  scope: FecScope | null = null,
): FecReport {
  const accountByCode = new Map(accounts.map((a) => [a.code, a]));
  const tierById = new Map(tiers.map((t) => [t.id, t]));

  const validatedAll = entries.filter((e) => e.status === "validated");
  const validated = (scope ? entriesInScope(validatedAll, scope) : validatedAll)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.number).localeCompare(String(b.number)));
  const excludedCount = validatedAll.length - validated.length;

  const rows: string[][] = [];
  const unbalanced: string[] = [];
  const duplicateNumbers: string[] = [];
  const seenNumbers = new Map<string, number>();
  const journalSeq = new Map<string, number>();
  let tierAccountLines = 0;
  let tierAccountMissing = 0;
  let totalDebit = 0;
  let totalCredit = 0;

  for (const e of validated) {
    const journal = journals.find((j) => j.id === e.journalId);
    const journalCode = journal?.code || "ODV";
    const journalLib = JOURNAL_LABELS[journal?.type || "misc"] || "Opérations diverses";

    const entryDebit = e.lines.reduce((s, l) => s + (l.debit || 0), 0);
    const entryCredit = e.lines.reduce((s, l) => s + (l.credit || 0), 0);
    if (Math.abs(entryDebit - entryCredit) > 0.004) {
      unbalanced.push(`${e.number} (écart ${(entryDebit - entryCredit).toFixed(2)})`);
    }

    // Numéro d'écriture FEC : séquence continue et chronologique PAR journal.
    // Le numéro de pièce interne est conservé dans PieceRef, pas ici : un
    // EcritureNum troué ou réutilisé fait rejeter le fichier par un outil de
    // contrôle.
    const seq = (journalSeq.get(journalCode) ?? 0) + 1;
    journalSeq.set(journalCode, seq);
    const ecritureNum = `${journalCode}-${String(seq).padStart(4, "0")}`;

    const numberKey = `${journalCode}|${e.number}`;
    const occurrences = (seenNumbers.get(numberKey) ?? 0) + 1;
    seenNumbers.set(numberKey, occurrences);
    if (occurrences === 2) duplicateNumbers.push(`${journalCode} ${e.number}`);

    for (const l of e.lines) {
      const account = accountByCode.get(l.accountId);
      const tier = l.thirdPartyId ? tierById.get(l.thirdPartyId) : undefined;
      // Comptes de tiers (401/411…) : une ligne sans auxiliaire est une
      // écriture qu'aucune balance âgée ne pourra jamais expliquer.
      if (/^(40|41)/.test(l.accountId)) {
        tierAccountLines += 1;
        if (!tier) tierAccountMissing += 1;
      }
      const debit = l.debit || 0;
      const credit = l.credit || 0;
      totalDebit += debit;
      totalCredit += credit;

      rows.push([
        clean(journalCode),
        clean(journalLib),
        ecritureNum,
        fecDate(e.date),
        clean(l.accountId),
        clean(account?.label || ""),
        clean(tier?.code || ""),
        clean(tier?.name || ""),
        clean(e.reference || e.number),
        fecDate(e.date),
        clean(l.label && l.label !== account?.label ? l.label : e.label),
        fecAmount(debit),
        fecAmount(credit),
        clean(l.letter || ""),
        "", // DateLet : date de lettrage, non historisée à ce jour
        fecDate(e.updatedAt), // ValidDate : dernière validation connue (voir contrôle)
        fecAmount(0), // Montantdevise : montants tenus en XOF, pas de devise étrangère
        "XOF",
      ]);
    }
  }

  const ecart = Math.round((totalDebit - totalCredit) * 100) / 100;

  const controls: FecControl[] = [
    {
      id: "perimetre",
      label: "Périmètre : écritures validées uniquement",
      level: "ok",
      detail: `${validated.length} écriture(s) validée(s) exportée(s), ${entries.length - validated.length} brouillon(s) exclu(s).`,
    },
    {
      id: "format",
      label: "Format des montants (point décimal, 2 décimales)",
      level: "ok",
      detail: "Aucun séparateur de milliers, aucun espace : lisible par un outil de contrôle.",
    },
    {
      id: "devise",
      label: "Devise renseignée",
      level: "ok",
      detail: "Idevise = XOF sur chaque ligne ; aucun montant en devise étrangère n'est transporté.",
    },
    {
      id: "equilibre",
      label: "Σ débit = Σ crédit sur le fichier",
      level: ecart === 0 ? "ok" : "blocking",
      detail: ecart === 0 ? `Équilibre exact : ${totalDebit.toFixed(2)}.` : `Écart de ${ecart.toFixed(2)} : le fichier n'est pas déposable.`,
    },
    {
      id: "ecritures",
      label: "Chaque écriture est équilibrée",
      level: unbalanced.length === 0 ? "ok" : "blocking",
      detail: unbalanced.length === 0 ? "Toutes les écritures exportées le sont." : `${unbalanced.length} écriture(s) déséquilibrée(s) : ${unbalanced.slice(0, 5).join(", ")}.`,
    },
    {
      id: "numerotation",
      label: "Numérotation continue par journal",
      level: "ok",
      detail: `${journalSeq.size} journal(aux) renuméroté(s) en séquence 1..n, dans l'ordre chronologique.`,
    },
    {
      id: "doublons",
      label: "Numéros de pièce uniques",
      level: duplicateNumbers.length === 0 ? "ok" : "warning",
      detail: duplicateNumbers.length === 0 ? "Aucun doublon détecté." : `Doublons : ${duplicateNumbers.slice(0, 5).join(", ")} (numérotation « count + 1 » : voir registre).`,
    },
    {
      id: "periode",
      label: "Période couverte",
      level: "ok",
      detail: validated.length === 0
        ? "Fichier vide : aucune écriture validée."
        : `Du ${fecDate(validated[0].date)} au ${fecDate(validated[validated.length - 1].date)} (exercice non filtré : l'export couvre tout l'historique validé de l'entreprise).`,
    },
    {
      id: "auxiliaires",
      label: "Auxiliaires sur les comptes de tiers",
      level: tierAccountMissing === 0 ? "ok" : "warning",
      detail: tierAccountLines === 0
        ? "Aucune ligne de compte de tiers (40x/41x) dans le périmètre."
        : `${tierAccountLines - tierAccountMissing}/${tierAccountLines} ligne(s) de tiers portent un code auxiliaire${tierAccountMissing ? ` ; ${tierAccountMissing} sans tiers identifié` : ""}.`,
    },
    {
      id: "lettrage",
      label: "Lettrage et date de lettrage",
      level: "warning",
      detail: "DateLet non historisée : le code de lettrage est exporté, sa date reste vide.",
    },
    {
      id: "validDate",
      label: "Date de validation",
      level: "warning",
      detail: "Renseignée avec la dernière mise à jour de l'écriture : aucune date de validation dédiée n'est stockée.",
    },
  ];

  const content = [FEC_COLUMNS.join("|"), ...rows.map((r) => r.join("|"))].join("\n");

  return {
    header: [...FEC_COLUMNS],
    rows,
    content,
    entryCount: validated.length,
    lineCount: rows.length,
    totals: { debit: totalDebit, credit: totalCredit, ecart },
    controls,
    blockingCount: controls.filter((c) => c.level === "blocking").length,
    warningCount: controls.filter((c) => c.level === "warning").length,
    scope,
    excludedCount,
  };
}

/** Nom de fichier conforme : FEC_AAAAMMJJ_raisonSociale.txt */
export function fecFileName(companyName: string, date: Date = new Date(), exercise?: string): string {
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
  const safe = (v: string) => v.replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/^_+|_+$/g, "");
  const suffix = safe(exercise || "") ? `_${safe(exercise!)}` : "";
  return `FEC_${stamp}_${safe(companyName)}${suffix}.txt`;
}
