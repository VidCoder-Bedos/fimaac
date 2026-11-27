// ============================================================================
// FIMAAC — CROSS-CHECK ENGINE (Réconciliation transversale)
// Compare les données entre TOUS les modules : Compta ↔ TVA ↔ Paie ↔ CNSS
// ↔ DAS ↔ Banque ↔ États financiers ↔ Liasse. Chaque écart = anomalie.
// ============================================================================
import type { JournalEntry, Employee } from "./types";
import { movementsByAccount } from "./accounting";
import { reconcileVAT } from "./regulatory-extensions";

export type CrossCheckLevel = "ok" | "info" | "warning" | "critical";

export interface CrossCheckResult {
  moduleName: string;
  valueA: number;
  valueB: number;
  ecart: number;
  level: CrossCheckLevel;
  detail: string;
}

export interface CrossCheckReport {
  checks: CrossCheckResult[];
  totalEcart: number;
  criticalCount: number;
  warningCount: number;
  okCount: number;
  overallStatus: CrossCheckLevel;
}

/**
 * Exécute TOUS les contrôles croisés sur une entreprise.
 *
 * Comparaisons effectuées :
 * 1. Σ Débit = Σ Crédit (balance)
 * 2. CA comptable ≈ CA TVA
 * 3. Salaires comptables (classe 66) vs total paie
 * 4. Cotisations CNSS comptables (431) vs calculées
 * 5. CNSS déclarée vs CNSS calculée
 * 6. Banque : opérations non rapprochées
 * 7. Immobilisations vs amortissements
 */
export function runCrossChecks(data: {
  entries: JournalEntry[];
  employees: Employee[];
  bankTransactions: { reconciled: boolean; amount: number }[];
  fixedAssets: { cost: number; residualValue: number; usefulLifeYears: number }[];
  declaredCNSS?: number;
  declaredTVA?: number;
  cnssEmployeeRate?: number;
}): CrossCheckReport {
  const checks: CrossCheckResult[] = [];
  const moves = movementsByAccount(data.entries);

  // ---- 1. Σ Débit = Σ Crédit ----
  const totalDebit = data.entries.reduce((s, e) => s + e.lines.reduce((a, l) => a + l.debit, 0), 0);
  const totalCredit = data.entries.reduce((s, e) => s + e.lines.reduce((a, l) => a + l.credit, 0), 0);
  checks.push({
    moduleName: "Balance",
    valueA: totalDebit,
    valueB: totalCredit,
    ecart: totalDebit - totalCredit,
    level: Math.abs(totalDebit - totalCredit) < 1 ? "ok" : "critical",
    detail: `Σ Débit = ${totalDebit.toLocaleString("fr-FR")} · Σ Crédit = ${totalCredit.toLocaleString("fr-FR")}`,
  });

  // ---- 2. TVA réconciliation ----
  const vatRecon = reconcileVAT(data.entries);
  for (const anomaly of vatRecon.anomalies) {
    checks.push({
      moduleName: "TVA",
      valueA: vatRecon.caComptable,
      valueB: vatRecon.caTva,
      ecart: vatRecon.ecartCa,
      level: anomaly.level as CrossCheckLevel,
      detail: anomaly.message,
    });
  }

  // ---- 3. Salaires comptables vs total paie ----
  const salairesCompta = data.entries
    .filter((e) => e.status === "validated")
    .flatMap((e) => e.lines)
    .filter((l) => l.accountId.startsWith("661") || l.accountId.startsWith("66"))
    .reduce((s, l) => s + l.debit, 0);
  const totalPaie = data.employees.reduce((s, e) => s + e.grossSalary, 0);
  if (data.employees.length > 0) {
    checks.push({
      moduleName: "Paie ↔ Comptabilité",
      valueA: salairesCompta,
      valueB: totalPaie,
      ecart: salairesCompta - totalPaie,
      level: Math.abs(salairesCompta - totalPaie) < 1000 ? "ok" : "warning",
      detail: `Compta (classe 66): ${salairesCompta.toLocaleString("fr-FR")} · Paie: ${totalPaie.toLocaleString("fr-FR")}`,
    });
  }

  // ---- 4. CNSS comptable vs CNSS calculée ----
  const cnssRate = data.cnssEmployeeRate ?? 4;
  let cnssCompta = 0;
  for (const [code, m] of moves) {
    if (code.startsWith("431")) cnssCompta += m.credit - m.debit;
  }
  const cnssCalculee = Math.round(totalPaie * cnssRate / 100);
  if (data.employees.length > 0) {
    checks.push({
      moduleName: "CNSS ↔ Paie",
      valueA: cnssCompta,
      valueB: cnssCalculee,
      ecart: cnssCompta - cnssCalculee,
      level: Math.abs(cnssCompta - cnssCalculee) < 1000 ? "ok" : "warning",
      detail: `CNSS compta (431): ${cnssCompta.toLocaleString("fr-FR")} · CNSS calculée (${cnssRate}%): ${cnssCalculee.toLocaleString("fr-FR")}`,
    });
  }

  // ---- 5. CNSS déclarée vs CNSS calculée ----
  if (data.declaredCNSS !== undefined && data.employees.length > 0) {
    checks.push({
      moduleName: "CNSS déclarée ↔ calculée",
      valueA: data.declaredCNSS,
      valueB: cnssCalculee,
      ecart: data.declaredCNSS - cnssCalculee,
      level: Math.abs(data.declaredCNSS - cnssCalculee) < 1000 ? "ok" : "critical",
      detail: `Déclarée: ${data.declaredCNSS.toLocaleString("fr-FR")} · Calculée: ${cnssCalculee.toLocaleString("fr-FR")}`,
    });
  }

  // ---- 6. Banque : opérations non rapprochées ----
  const unreconciled = data.bankTransactions.filter((t) => !t.reconciled);
  if (data.bankTransactions.length > 0) {
    checks.push({
      moduleName: "Banque",
      valueA: unreconciled.length,
      valueB: 0,
      ecart: unreconciled.length,
      level: unreconciled.length > 5 ? "critical" : unreconciled.length > 0 ? "warning" : "ok",
      detail: `${unreconciled.length} transaction(s) non rapprochée(s) sur ${data.bankTransactions.length}`,
    });
  }

  // ---- 7. Immobilisations vs amortissements ----
  if (data.fixedAssets.length > 0) {
    const totalImmo = data.fixedAssets.reduce((s, a) => s + a.cost, 0);
    let amortCompta = 0;
    for (const [code, m] of moves) {
      if (code.startsWith("28") || code.startsWith("29")) amortCompta += m.credit - m.debit;
    }
    checks.push({
      moduleName: "Immobilisations",
      valueA: totalImmo,
      valueB: amortCompta,
      ecart: 0,
      level: "info",
      detail: `${data.fixedAssets.length} immobilisation(s) · Brut: ${totalImmo.toLocaleString("fr-FR")} · Amort: ${amortCompta.toLocaleString("fr-FR")}`,
    });
  }

  // ---- Calcul du statut global ----
  const criticalCount = checks.filter((c) => c.level === "critical").length;
  const warningCount = checks.filter((c) => c.level === "warning").length;
  const okCount = checks.filter((c) => c.level === "ok").length;
  const totalEcart = checks.reduce((s, c) => s + Math.abs(c.ecart), 0);
  const overallStatus: CrossCheckLevel = criticalCount > 0 ? "critical" : warningCount > 0 ? "warning" : "ok";

  return { checks, totalEcart, criticalCount, warningCount, okCount, overallStatus };
}
