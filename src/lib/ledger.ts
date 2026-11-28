import type { JournalEntry, Account, ThirdParty } from "./types";
import { accountSituation } from "./accounting";
import { daysUntil } from "./format";
import { buildFec, fecFileName } from "./fec";

function dl(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const fc = (n: number) => new Intl.NumberFormat("fr-FR").format(n || 0);

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

/**
 * Export FEC — délègue entièrement à `lib/fec.ts` (18 colonnes, point décimal,
 * devise renseignée, contrôles associés). Conservé comme point d'entrée pour
 * ne pas casser les appelants existants.
 */
export function exportFEC(
  entries: JournalEntry[],
  journals: { id: string; code: string; type: string }[],
  accounts: Account[],
  companyName: string,
  tiers: ThirdParty[] = [],
) {
  const report = buildFec(entries, journals, accounts, tiers);
  dl(fecFileName(companyName), report.content, "text/plain;charset=utf-8");
  return report;
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
