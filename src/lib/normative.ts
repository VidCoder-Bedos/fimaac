// ============================================================================
// FIMAAC — Moteur de cohérence NORMATIVE
// Le plan comptable SYSCOHADA révisé est la SOURCE DE VÉRITÉ UNIQUE.
// Toute la chaîne (écritures → balance → états financiers) doit en dériver de façon contrôlée.
// ============================================================================
import type { Account, JournalEntry } from "./types";
import { CHART_OF_ACCOUNTS } from "./chartOfAccounts";

export interface NormCheck {
  id: string;
  category: string;
  title: string;
  status: "OK!" | "Déséquilibré" | "Avertissement";
  detail: string;
  data?: string;
}

export interface NormReport {
  checks: NormCheck[];
  score: number;
  okCount: number;
  koCount: number;
  warnCount: number;
  chartStats: { classes: Record<number, number>; maxDepth: number; total: number; postable: number };
}

export function chartStatistics(accounts: Account[] = CHART_OF_ACCOUNTS) {
  const classes: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
  let maxDepth = 0;
  let postable = 0;
  for (const a of accounts) {
    classes[a.classNumber]++;
    if (a.depth && a.depth > maxDepth) maxDepth = a.depth;
    if (a.postable) postable++;
  }
  return { classes, maxDepth, total: accounts.length, postable };
}

/**
 * Audit normatif de la chaîne comptable d'une entreprise.
 * @param entries écritures de l'entreprise (tous statuts)
 * @param accounts plan comptable
 * @param mappingMissing préfixes de mapping d'état absents du plan (de mappingCoverage)
 */
export function auditNormativeCoherence(entries: JournalEntry[], accounts: Account[] = CHART_OF_ACCOUNTS, mappingMissing: string[] = []): NormReport {
  const checks: NormCheck[] = [];
  const codes = new Map(accounts.map((a) => [a.code, a]));

  // 1. Plan complet — 8 classes présentes
  const stats = chartStatistics(accounts);
  const missingClasses = [1, 2, 3, 4, 5, 6, 7, 8].filter((c) => stats.classes[c] === 0);
  checks.push({
    id: "plan.classes",
    category: "Plan comptable",
    title: "Plan complet — 8 classes SYSCOHADA présentes",
    status: missingClasses.length ? "Déséquilibré" : "OK!",
    detail: missingClasses.length ? `Classes manquantes : ${missingClasses.join(", ")}` : "Les 8 classes (1→8) sont présentes.",
    data: Object.entries(stats.classes).map(([k, v]) => `Classe ${k}: ${v}`).join(" · "),
  });

  // 2. Profondeur des subdivisions
  checks.push({
    id: "plan.depth",
    category: "Plan comptable",
    title: "Profondeur des subdivisions atteinte",
    status: stats.maxDepth >= 4 ? "OK!" : "Avertissement",
    detail: `Profondeur maximale : ${stats.maxDepth} niveaux (classe → principal → divisionnaire → sous-compte${stats.maxDepth >= 5 ? " → subdivision" : ""}).`,
    data: `${stats.total} comptes · ${stats.postable} imputables`,
  });

  // 3. Écritures — comptes existants dans le plan
  const unknown: { entry: string; account: string }[] = [];
  const nonPostable: { entry: string; account: string; label: string }[] = [];
  for (const e of entries) {
    for (const l of e.lines) {
      const acc = codes.get(l.accountId);
      if (!acc) unknown.push({ entry: e.number, account: l.accountId });
      else if (!acc.postable) nonPostable.push({ entry: e.number, account: l.accountId, label: acc.label });
    }
  }
  checks.push({
    id: "ecr.existence",
    category: "Écritures",
    title: "Tous les comptes des écritures existent dans le plan",
    status: unknown.length ? "Déséquilibré" : "OK!",
    detail: unknown.length
      ? `${unknown.length} ligne(s) pointent un compte inexistant : ${unknown.slice(0, 5).map((u) => u.account).join(", ")}${unknown.length > 5 ? "…" : ""}`
      : `${entries.reduce((s, e) => s + e.lines.length, 0)} ligne(s) d'écriture toutes rattachées au plan.`,
  });

  // 4. Écritures — comptes imputables (pas un compte de titre)
  checks.push({
    id: "ecr.postable",
    category: "Écritures",
    title: "Aucune imputation sur compte de titre (non imputable)",
    status: nonPostable.length ? "Déséquilibré" : "OK!",
    detail: nonPostable.length
      ? `${nonPostable.length} ligne(s) sur compte de titre : ${nonPostable.slice(0, 5).map((u) => `${u.account} (${u.label})`).join(", ")}`
      : "Toutes les imputations portent sur des comptes imputables.",
  });

  // 5. Intégrité — chaque écriture équilibrée (débit = crédit)
  const unbalanced = entries.filter((e) => {
    const d = e.lines.reduce((s, l) => s + l.debit, 0);
    const c = e.lines.reduce((s, l) => s + l.credit, 0);
    return d !== c;
  });
  checks.push({
    id: "ecr.balanced",
    category: "Intégrité comptable",
    title: "Chaque écriture est équilibrée (Σ Débit = Σ Crédit)",
    status: unbalanced.length ? "Déséquilibré" : "OK!",
    detail: unbalanced.length ? `${unbalanced.length} écriture(s) déséquilibrée(s).` : `${entries.length} écriture(s) toutes équilibrées.`,
  });

  // 6. Équilibre global (écritures validées)
  const validated = entries.filter((e) => e.status === "validated");
  const totD = validated.reduce((s, e) => s + e.lines.reduce((a, l) => a + l.debit, 0), 0);
  const totC = validated.reduce((s, e) => s + e.lines.reduce((a, l) => a + l.credit, 0), 0);
  checks.push({
    id: "ecr.global",
    category: "Intégrité comptable",
    title: "Équilibre global des écritures validées",
    status: totD === totC ? "OK!" : "Déséquilibré",
    detail: `Σ Débit = ${totD.toLocaleString("fr-FR")} FCFA · Σ Crédit = ${totC.toLocaleString("fr-FR")} FCFA · Écart = ${Math.abs(totD - totC).toLocaleString("fr-FR")} FCFA.`,
  });

  // 7. Mapping états financiers — tous les préfixes présents dans le plan
  checks.push({
    id: "map.coverage",
    category: "États financiers",
    title: "Mapping SYSCOHADA (comptes → références d'état) couvert par le plan",
    status: mappingMissing.length ? "Avertissement" : "OK!",
    detail: mappingMissing.length
      ? `${mappingMissing.length} référence(s) sans compte correspondant : ${mappingMissing.slice(0, 6).join(", ")}`
      : "Toutes les références d'état (Bilan, CR, TFT) sont rattachées à des comptes du plan.",
  });

  // 8. Cohérence de la chaîne : la balance ne se calcule QUE sur des écritures validées + comptes existants
  const chainOk = unknown.length === 0 && nonPostable.length === 0 && unbalanced.length === 0;
  checks.push({
    id: "chaine",
    category: "Chaîne comptable",
    title: "Chaîne complète : écritures → balance → états financiers cohérente",
    status: chainOk ? "OK!" : "Déséquilibré",
    detail: chainOk
      ? "Les écritures alimentent une balance fiable qui se projette dans les états financiers (Bilan, CR, TAFIRE) sans rupture."
      : "Des écritures non conformes empêchent une projection fiable des états financiers. Corrigez-les d'abord.",
  });

  const okCount = checks.filter((c) => c.status === "OK!").length;
  const koCount = checks.filter((c) => c.status === "Déséquilibré").length;
  const warnCount = checks.filter((c) => c.status === "Avertissement").length;
  const score = checks.length ? Math.round((okCount / checks.length) * 100) : 0;

  return { checks, score, okCount, koCount, warnCount, chartStats: stats };
}
