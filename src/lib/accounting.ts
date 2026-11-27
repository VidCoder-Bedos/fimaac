import type { Account, JournalEntry, JournalEntryLine } from "./types";

export interface RatioItem { key: string; label: string; value: string; raw: number; tone: "emerald" | "amber" | "rose" | "indigo"; desc: string; }

/** Calcule les principaux ratios financiers (réels, depuis les écritures validées). */
export function computeRatios(s: { produits: number; ca: number; charges: number; resultat: number; tresorerie: number; creances: number; dettes: number; immobilisations: number; capitaux: number }): RatioItem[] {
  const out: RatioItem[] = [];
  const pct = (n: number) => (Number.isFinite(n) ? `${n.toFixed(1)} %` : "—");
  const day = (n: number) => (Number.isFinite(n) ? `${Math.round(n)} j` : "—");

  // Marge nette — M4 : calculée sur le CA (701-707), pas sur toute la classe 7
  const marge = s.ca ? (s.resultat / s.ca) * 100 : 0;
  out.push({ key: "marge", label: "Marge nette", value: pct(marge), raw: marge, tone: marge >= 0 ? "emerald" : "rose", desc: "Résultat / Chiffre d'affaires" });

  // Taux de charges
  const txCh = s.produits ? (s.charges / s.produits) * 100 : 0;
  out.push({ key: "charges", label: "Taux de charges", value: pct(txCh), raw: txCh, tone: txCh <= 100 ? "emerald" : "rose", desc: "Charges / Produits" });

  // Rentabilité financière (Résultat / Capitaux)
  const rent = s.capitaux ? (s.resultat / s.capitaux) * 100 : 0;
  out.push({ key: "rentabilite", label: "Rentabilité (RNP/capitaux)", value: pct(rent), raw: rent, tone: rent >= 5 ? "emerald" : "amber", desc: "Résultat / Capitaux propres" });

  // Délai moyen de règlement client (créances / CA HT * 360)
  const delaiCli = s.ca ? (s.creances / s.ca) * 360 : 0;
  out.push({ key: "delaiCli", label: "Délai client", value: day(delaiCli), raw: delaiCli, tone: delaiCli <= 60 ? "emerald" : delaiCli <= 90 ? "amber" : "rose", desc: "Créances / CA × 360" });

  // Délai fournisseur (dettes / charges * 360)
  const delaiFourn = s.charges ? (s.dettes / s.charges) * 360 : 0;
  out.push({ key: "delaiFourn", label: "Délai fournisseur", value: day(delaiFourn), raw: delaiFourn, tone: delaiFourn >= 30 ? "emerald" : "amber", desc: "Dettes / Charges × 360" });

  // Ratio de liquidité (créances + trésorerie) / dettes
  const liq = s.dettes ? (s.creances + s.tresorerie) / s.dettes : 0;
  out.push({ key: "liquidite", label: "Liquidité (actif court / dettes)", value: liq ? liq.toFixed(2) : "—", raw: liq, tone: liq >= 1 ? "emerald" : "rose", desc: "(Créances + Trésorerie) / Dettes" });

  return out;
}

export interface Totals {
  debit: number;
  credit: number;
  diff: number;
  balanced: boolean;
}

export function entryTotals(lines: JournalEntryLine[]): Totals {
  const debit = lines.reduce((s, l) => s + Math.max(0, l.debit), 0);
  const credit = lines.reduce((s, l) => s + Math.max(0, l.credit), 0);
  const diff = debit - credit;
  return { debit, credit, diff, balanced: diff === 0 };
}

export function isEntryValidatable(entry: JournalEntry, accounts: Account[]): { ok: boolean; reason?: string } {
  if (entry.lines.length < 2) return { ok: false, reason: "Une écriture doit comporter au moins deux lignes." };
  const totals = entryTotals(entry.lines);
  if (totals.debit === 0 || totals.credit === 0) return { ok: false, reason: "L'écriture doit comporter un débit et un crédit." };
  if (!totals.balanced) return { ok: false, reason: `Écriture déséquilibrée : écart de ${totals.diff} FCFA. Total débit = total crédit est obligatoire.` };
  for (const l of entry.lines) {
    const acc = accounts.find((a) => a.code === l.accountId);
    if (!acc) return { ok: false, reason: `Compte ${l.accountId} introuvable.` };
    if (!acc.postable) return { ok: false, reason: `Le compte ${acc.code} (${acc.label}) n'est pas imputable.` };
    if (l.debit < 0 || l.credit < 0) return { ok: false, reason: "Les montants ne peuvent pas être négatifs." };
  }
  return { ok: true };
}

/** Sum movements per account code, from VALIDATED entries only. */
export function movementsByAccount(entries: JournalEntry[]): Map<string, { debit: number; credit: number }> {
  const map = new Map<string, { debit: number; credit: number }>();
  for (const e of entries) {
    if (e.status !== "validated") continue;
    for (const l of e.lines) {
      const cur = map.get(l.accountId) || { debit: 0, credit: 0 };
      cur.debit += l.debit;
      cur.credit += l.credit;
      map.set(l.accountId, cur);
    }
  }
  return map;
}

export interface TrialRow {
  code: string;
  label: string;
  debit: number;
  credit: number;
  soldeDebit: number;
  soldeCredit: number;
}

export function trialBalance(entries: JournalEntry[], accounts: Account[]): TrialRow[] {
  const moves = movementsByAccount(entries);
  const rows: TrialRow[] = [];
  for (const [code, m] of mapToSorted(moves)) {
    const acc = accounts.find((a) => a.code === code);
    const solde = m.debit - m.credit;
    rows.push({
      code,
      label: acc?.label || code,
      debit: m.debit,
      credit: m.credit,
      soldeDebit: solde > 0 ? solde : 0,
      soldeCredit: solde < 0 ? -solde : 0,
    });
  }
  return rows;
}

function mapToSorted(m: Map<string, { debit: number; credit: number }>) {
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export function ledgerForAccount(entries: JournalEntry[], accountCode: string): JournalEntryLine[] {
  const out: JournalEntryLine[] = [];
  for (const e of entries) {
    if (e.status !== "validated") continue;
    for (const l of e.lines) {
      if (l.accountId === accountCode) out.push({ ...l, label: `${l.label} — ${e.number}` });
    }
  }
  return out;
}

export interface FinancialSummary {
  produits: number; // class 7
  ca: number; // M4 — chiffre d'affaires strict (701-707), = sii.XB du SIG
  charges: number; // class 6
  resultat: number; // produits - charges
  tresorerie: number; // class 5
  creances: number; // 41
  dettes: number; // 40
  immobilisations: number; // class 2
  capitaux: number; // class 1
}

export function financialSummary(entries: JournalEntry[]): FinancialSummary {
  const moves = movementsByAccount(entries);
  const sum = (filter: (code: string) => boolean, side: "debit" | "credit") => {
    let t = 0;
    for (const [code, m] of moves) {
      if (!filter(code)) continue;
      t += side === "debit" ? m.debit - m.credit : m.credit - m.debit;
    }
    return t;
  };
  const produits = sum((c) => c.startsWith("7"), "credit");
  // M4 — CA strict : comptes 70x uniquement (ventes, travaux, services, produits
  // accessoires). Les subventions (71), production immobilisée (72), autres
  // produits (75), transferts (78-79) restent dans `produits` mais ne sont pas
  // du chiffre d'affaires — sinon le Dashboard contredit le SIG affiché à côté.
  const ca = sum((c) => c.startsWith("70"), "credit");
  const charges = sum((c) => c.startsWith("6"), "debit");
  return {
    produits,
    ca,
    charges,
    resultat: produits - charges,
    tresorerie: sum((c) => c.startsWith("5"), "debit"),
    creances: sum((c) => c.startsWith("411"), "debit"),
    dettes: sum((c) => c.startsWith("401"), "credit"),
    immobilisations: sum((c) => c.startsWith("2") && !c.startsWith("28") && !c.startsWith("29"), "debit"),
    capitaux: sum((c) => c.startsWith("1"), "credit"),
  };
}

export function classTotals(entries: JournalEntry[], accounts: Account[]): { classe: number; label: string; debit: number; credit: number; solde: number }[] {
  const moves = movementsByAccount(entries);
  const byClass = new Map<number, { debit: number; credit: number }>();
  for (const [code, m] of moves) {
    const acc = accounts.find((a) => a.code === code);
    if (!acc) continue;
    const cur = byClass.get(acc.classNumber) || { debit: 0, credit: 0 };
    cur.debit += m.debit;
    cur.credit += m.credit;
    byClass.set(acc.classNumber, cur);
  }
  return [...byClass.entries()].sort((a, b) => a[0] - b[0]).map(([classe, m]) => ({
    classe,
    label: `Classe ${classe}`,
    debit: m.debit,
    credit: m.credit,
    solde: m.debit - m.credit,
  }));
}

// ---------------- Account situation (Sage-style inquiry) ----------------
export interface SituationLine {
  entryId: string; number: string; date: string; journalCode: string;
  label: string; debit: number; credit: number; solde: number; tierId: string | null;
}

export interface AccountSituation {
  openingDebit: number; openingCredit: number;
  totalDebit: number; totalCredit: number; solde: number; lines: SituationLine[];
}

export function accountSituation(entries: JournalEntry[], accountCode: string, journals: { id: string; code: string }[], tierId?: string | null): AccountSituation {
  const jl = (jid: string) => journals.find((j) => j.id === jid)?.code || "";
  const sorted = entries
    .filter((e) => e.status === "validated")
    .sort((a, b) => +new Date(a.date) - +new Date(b.date) || a.number.localeCompare(b.number));
  const lines: SituationLine[] = [];
  let solde = 0;
  for (const e of sorted) {
    for (const l of e.lines) {
      if (l.accountId !== accountCode) continue;
      if (tierId && l.thirdPartyId !== tierId) continue;
      solde += l.debit - l.credit;
      lines.push({ entryId: e.id, number: e.number, date: e.date, journalCode: jl(e.journalId), label: l.label, debit: l.debit, credit: l.credit, solde, tierId: l.thirdPartyId ?? null });
    }
  }
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  return { openingDebit: 0, openingCredit: 0, totalDebit, totalCredit, solde, lines };
}
