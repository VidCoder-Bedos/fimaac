import type { JournalEntry, Account, ThirdParty } from "./types";
import { accountSituation } from "./accounting";
import { daysUntil } from "./format";

// Libellés FEC des types de journaux (alignés sur journals.ts — 18 types).
const JLIB: Record<string, string> = {
  sales: "Ventes", purchases: "Achats", bank: "Banque", cash: "Caisse",
  misc: "Opérations diverses", wages: "Salaires", fixed_assets: "Immobilisations",
  opening: "À nouveau", closing: "Clôture", cost: "Cessions",
  stock: "Stocks", tax: "Fiscalité", social: "Social",
  capital: "Capital", loans: "Emprunts", provisions: "Provisions",
  expenses: "Transferts de charges", accruals: "Régularisations",
};

function dl(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const fc = (n: number) => new Intl.NumberFormat("fr-FR").format(n || 0);
const fmtD = (iso: string) => (iso ? new Date(iso).toISOString().slice(0, 10).replace(/-/g, "") : "");

function parseDays(terms?: string): number {
  if (!terms) return 30;
  const m = terms.match(/(\d+)/);
  if (m) return parseInt(m[1], 10);
  if (/comptant/i.test(terms)) return 0;
  if (/mensuel/i.test(terms)) return 30;
  return 30;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Grand livre auxiliaire : situation de chaque tiers. */
export function auxiliaryLedger(entries: JournalEntry[], journals: { id: string; code: string; type: string }[], tiers: ThirdParty[]) {
  return tiers.map((t) => ({ tier: t, ...accountSituation(entries, t.collective, journals, t.id) }));
}

/** Balance âgée : lignes ouvertes (non lettrées) par tranches d'échéance. */
export interface AgedRow { tier: ThirdParty; total: number; tranches: number[]; open: { date: string; solde: number; days: number }[] }

export function agedBalance(entries: JournalEntry[], tiers: ThirdParty[], now = new Date()): AgedRow[] {
  return tiers.map((t) => {
    const open: { date: string; solde: number; days: number }[] = [];
    for (const e of entries) {
      if (e.status !== "validated") continue;
      for (const l of e.lines) {
        if (l.accountId === t.collective && l.thirdPartyId === t.id && !l.letter && (l.debit || l.credit)) {
          const days = Math.floor((now.getTime() - new Date(e.date).getTime()) / 86400000);
          open.push({ date: e.date, solde: l.debit - l.credit, days });
        }
      }
    }
    const tranches = [0, 0, 0, 0];
    for (const o of open) {
      const idx = o.days <= 30 ? 0 : o.days <= 60 ? 1 : o.days <= 90 ? 2 : 3;
      tranches[idx] += o.solde;
    }
    return { tier: t, total: open.reduce((s, o) => s + o.solde, 0), tranches, open };
  }).filter((r) => r.total !== 0);
}

/** Échéancier : factures ouvertes (à payer / à recevoir) avec date d'échéance calculée. */
export interface Echeance { type: string; tier: string; date: string; due: string; number: string; label: string; amount: number; days: number; overdue: boolean }

export function echeancier(entries: JournalEntry[], tiers: ThirdParty[]): Echeance[] {
  const out: Echeance[] = [];
  for (const e of entries) {
    if (e.status !== "validated") continue;
    for (const l of e.lines) {
      if (l.letter || !l.thirdPartyId) continue;
      const t = tiers.find((x) => x.id === l.thirdPartyId);
      if (!t) continue;
      const amount = l.debit - l.credit;
      if (!amount) continue;
      const due = addDays(e.date, parseDays(t.paymentTerms));
      const days = daysUntil(due);
      out.push({ type: t.type, tier: t.name, date: e.date, due, number: e.number, label: l.label, amount, days, overdue: days < 0 });
    }
  }
  return out.sort((a, b) => +new Date(a.due) - +new Date(b.due));
}

/** Export FEC-like (Fichier des Écritures Comptables) — format pipe, .txt. */
export function exportFEC(entries: JournalEntry[], journals: { id: string; code: string; type: string }[], accounts: Account[], companyName: string) {
  const header = ["JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum", "CompteLib", "CompAuxNum", "PieceRef", "EcritureLib", "Debit", "Credit", "EcritureLet", "DateRglt", "ValidDate", "Montantdevise"].join("|");
  const rows = [header];
  const sorted = entries.filter((e) => e.status === "validated").sort((a, b) => +new Date(a.date) - +new Date(b.date) || a.number.localeCompare(b.number));
  for (const e of sorted) {
    const j = journals.find((x) => x.id === e.journalId);
    for (const l of e.lines) {
      const acc = accounts.find((a) => a.code === l.accountId);
      const clean = (s: string) => (s || "").replace(/\|/g, " ").trim();
      rows.push([
        j?.code || "ODV", JLIB[j?.type || "misc"] || "ODV", e.number, fmtD(e.date),
        l.accountId, clean(acc?.label || ""), "", clean(e.reference), clean(l.label),
        (l.debit || 0).toFixed(2).replace(".", ","), (l.credit || 0).toFixed(2).replace(".", ","),
        l.letter || "", "", fmtD(e.date), "",
      ].join("|"));
    }
  }
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  dl(`FEC_${today}_${companyName.replace(/\s+/g, "_")}.txt`, rows.join("\n"), "text/plain;charset=utf-8");
}

export function exportAgedCSV(rows: AgedRow[], name: string) {
  const header = ["Tiers", "Type", "0-30 j", "31-60 j", "61-90 j", "+90 j", "Total"];
  const body = rows.map((r) => [r.tier.name, r.tier.type === "customer" ? "Client" : "Fournisseur", r.tranches[0], r.tranches[1], r.tranches[2], r.tranches[3], r.total]);
  const csv = [header, ...body].map((r) => r.map((c) => `"${fc(Number(c))}"`).join(";")).join("\n");
  dl(name, "\uFEFF" + csv, "text/csv;charset=utf-8");
}

export function exportEcheancierCSV(rows: Echeance[], name: string) {
  const header = ["Type", "Tiers", "Pièce", "Libellé", "Date", "Échéance", "Montant", "Retard"];
  const body = rows.map((r) => [r.type === "customer" ? "À recevoir" : "À payer", r.tier, r.number, r.label, r.date, r.due, r.amount, r.overdue ? "Oui" : "Non"]);
  const csv = [header, ...body].map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
  dl(name, "\uFEFF" + csv, "text/csv;charset=utf-8");
}
