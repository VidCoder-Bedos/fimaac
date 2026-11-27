import { useMemo } from "react";
import { useDB } from "./store";
import { runCoherenceChecks, mappingCoverage } from "./liasseEngine";
import { auditNormativeCoherence } from "./normative";
import { CHART_OF_ACCOUNTS } from "./chartOfAccounts";
import { movementsByAccount } from "./accounting";
import type { JournalEntry } from "./types";
import type { BalanceRow } from "./liasse";
// ============================================================================
// FIMAAC — Moteur de cohérence RÉACTIF (V1.2)
// Recalcule automatiquement les contrôles au fur et à mesure des mutations.
// ============================================================================
export interface LiveCoherence {
  // Contrôles C1…C9 (depuis les écritures validées de l'entreprise)
  coherence: ReturnType<typeof runCoherenceChecks>;
  // Contrôle normatif du plan (écritures vs plan source de vérité)
  normative: ReturnType<typeof auditNormativeCoherence>;
  // Anomalies de conformité ouvertes
  openIssues: number;
  criticalIssues: number;
  // Score global (moyenne pondérée cohérence + normatif)
  score: number;
  isLive: boolean;
  /** Construit une balance N (un exercice) à partir des écritures validées. */
  syntheticBalance: BalanceRow[];
}

/** Construit une balance synthétique (un exercice) à partir des écritures validées d'une entreprise. */
export function syntheticBalanceFromEntries(entries: JournalEntry[]): BalanceRow[] {
  const map = movementsByAccount(entries);
  const rows: BalanceRow[] = [];
  for (const [code, m] of [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    rows.push({ code, label: "", debit: m.debit, credit: m.credit });
  }
  return rows;
}

/**
 * Hook réactif : recalcule la cohérence d'une entreprise à CHAQUE mutation du store.
 * Mémoïsé sur les entrées pertinentes pour limiter le coût.
 */
export function useLiveCoherence(companyId: string): LiveCoherence {
  const db = useDB();
  // Dépendances : on recompute dès que les écritures/comptes/anomalies changent
  const entries = db.entries.filter((e) => e.companyId === companyId);
  const issues = db.complianceIssues.filter((i) => i.companyId === companyId && !i.resolved);
  const entrySignature = entries.map((e) => `${e.id}:${e.status}:${e.lines.length}`).join("|");
  const accountIds = entries.flatMap((e) => e.lines.map((l) => l.accountId)).join(",");

  return useMemo(() => {
    const syntheticBalance = syntheticBalanceFromEntries(entries);
    // C1…C9 : N = exercice courant (synthetic), N-1 = vide (pas d'exercice antérieur en démo)
    const coherence = runCoherenceChecks([], syntheticBalance);
    // Contrôle normatif
    const coverage = mappingCoverage(CHART_OF_ACCOUNTS);
    const normative = auditNormativeCoherence(entries, CHART_OF_ACCOUNTS, coverage.missing);
    const openIssues = issues.length;
    const criticalIssues = issues.filter((i) => i.severity === "critical").length;
    // Score global : 60% cohérence + 30% normatif + 10% anomalies
    const anomalyScore = issues.length ? Math.max(0, 100 - issues.length * 12) : 100;
    const score = Math.round(coherence.score * 0.6 + normative.score * 0.3 + anomalyScore * 0.1);
    return { coherence, normative, openIssues, criticalIssues, score, isLive: true, syntheticBalance };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrySignature, accountIds, issues.length, companyId]);
}

/** Évalue l'ensemble du portefeuille (toutes les entreprises d'une organisation), en une passe. */
export function usePortfolioCoherence(organizationId: string) {
  const db = useDB();
  const companies = db.companies.filter((c) => c.organizationId === organizationId);
  const sig = companies.map((c) => `${c.id}:${db.entries.filter((e) => e.companyId === c.id).length}:${db.complianceIssues.filter((i) => i.companyId === c.id && !i.resolved).length}`).join("|");
  return useMemo(() => {
    return companies.map((c) => {
      const entries = db.entries.filter((e) => e.companyId === c.id);
      const synthetic = syntheticBalanceFromEntries(entries);
      const coh = runCoherenceChecks([], synthetic);
      const norm = auditNormativeCoherence(entries, CHART_OF_ACCOUNTS, mappingCoverage(CHART_OF_ACCOUNTS).missing);
      const issues = db.complianceIssues.filter((i) => i.companyId === c.id && !i.resolved);
      const score = Math.round(coh.score * 0.6 + norm.score * 0.3 + (issues.length ? Math.max(0, 100 - issues.length * 12) : 100) * 0.1);
      const critical = issues.filter((i) => i.severity === "critical").length;
      return { company: c, score, coherence: coh, normative: norm, issues: issues.length, critical, entries: entries.length };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
}
