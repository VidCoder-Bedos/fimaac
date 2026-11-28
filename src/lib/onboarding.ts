// ============================================================================
// FIMAAC — Parcours d'amorçage (P23)
//
// Constat d'audit (§D, point 14) : rien ne disait **par où commencer**. Un
// cabinet qui ouvre le produit pour la première fois arrive sur un tableau de
// bord vide, et doit deviner qu'il faut d'abord une entreprise, puis un
// exercice, puis des écritures, puis des contrôles, avant qu'une liasse ait le
// moindre sens. Les écrans vides ne disent pas non plus ce qui manque.
//
// Ici, six étapes **déduites de l'état réel** du dossier — pas d'un compteur
// local qu'on pourrait cocher sans rien faire. Chaque étape porte sa raison
// d'être et son lien : on ne renvoie jamais vers un écran sans dire quoi y faire.
// ============================================================================

import type { DBState } from "./types";
import { trialBalance } from "./accounting";

export type OnboardingStatus = "done" | "current" | "todo";

export interface OnboardingStep {
  id: string;
  /** Numéro d'ordre affiché (1 à 6). */
  order: number;
  title: string;
  /** Pourquoi cette étape existe — en une phrase, sans jargon. */
  why: string;
  /** Ce que l'état du dossier montre, chiffré quand c'est possible. */
  hint: string;
  href: string;
  cta: string;
  status: OnboardingStatus;
}

export interface OnboardingReport {
  steps: OnboardingStep[];
  /** Nombre d'étapes satisfaites. */
  done: number;
  total: number;
  /** Étape à faire maintenant, `null` si le parcours est complet. */
  next: OnboardingStep | null;
  /** Message d'ensemble, prêt à afficher. */
  summary: string;
  complete: boolean;
}

interface StepDef {
  id: string;
  title: string;
  why: string;
  href: string;
  cta: string;
  evaluate: (db: DBState, companyId: string | null) => { done: boolean; hint: string };
}

const STEP_DEFS: StepDef[] = [
  {
    id: "organisation",
    title: "Le cabinet",
    why: "Les dossiers, les utilisateurs et les journaux d'audit sont rattachés à une organisation : sans elle, rien n'est cloisonné.",
    href: "/app/parametres",
    cta: "Vérifier le cabinet",
    evaluate: (db) => {
      const org = db.organizations[0];
      const named = !!org && String(org.name || "").trim().length > 0;
      return {
        done: named,
        hint: named ? `Organisation « ${org!.name} »` : "Aucune organisation nommée",
      };
    },
  },
  {
    id: "entreprise",
    title: "L'entreprise",
    why: "Le NIF identifie le contribuable : sans lui, aucune déclaration n'est déposable et aucun état n'est opposable.",
    href: "/app/entreprises",
    cta: "Créer ou compléter l'entreprise",
    evaluate: (db, companyId) => {
      const withNif = db.companies.filter((c) => String(c.nif || "").trim().length > 0);
      const current = companyId ? db.companies.find((c) => c.id === companyId) : undefined;
      const done = current ? String(current.nif || "").trim().length > 0 : withNif.length > 0;
      return {
        done,
        hint: done
          ? current
            ? `NIF ${current.nif} — ${current.tradeName || current.name}`
            : `${withNif.length} entreprise(s) identifiée(s)`
          : current
            ? `NIF manquant pour ${current.tradeName || current.name}`
            : "Aucune entreprise",
      };
    },
  },
  {
    id: "exercice",
    title: "L'exercice",
    why: "Une écriture doit tomber dans un exercice et une période ouverts : c'est ce qui rend les bornes vérifiables.",
    href: "/app/comptabilite",
    cta: "Ouvrir l'exercice",
    evaluate: (db, companyId) => {
      const years = companyId ? db.fiscalYears.filter((y) => y.companyId === companyId) : db.fiscalYears;
      const open = years.filter((y) => y.status === "open");
      const periods = companyId ? db.periods.filter((p) => p.companyId === companyId) : db.periods;
      return {
        done: open.length > 0,
        hint: open.length > 0
          ? `${open.length} exercice(s) ouvert(s) · ${periods.length} période(s)`
          : years.length > 0 ? `${years.length} exercice(s), tous clôturés` : "Aucun exercice ouvert",
      };
    },
  },
  {
    id: "ecritures",
    title: "Les écritures",
    why: "La balance est la seule source des états : sans écritures, tout ce qui suit serait une coquille vide.",
    href: "/app/comptabilite",
    cta: "Saisir ou importer les écritures",
    evaluate: (db, companyId) => {
      const entries = companyId ? db.entries.filter((e) => e.companyId === companyId) : db.entries;
      return {
        done: entries.length > 0,
        hint: entries.length > 0 ? `${entries.length} écriture(s)` : "Aucune écriture",
      };
    },
  },
  {
    id: "controles",
    title: "Les contrôles de balance",
    why: "Une balance déséquilibrée ne se voit pas dans un bilan : elle se voit dans un contrôle. Autant le faire avant la liasse.",
    href: "/app/comptabilite",
    cta: "Lancer les contrôles",
    evaluate: (db, companyId) => {
      const entries = companyId ? db.entries.filter((e) => e.companyId === companyId) : db.entries;
      if (entries.length === 0) return { done: false, hint: "En attente des écritures" };
      const rows = trialBalance(entries, db.accounts);
      const debit = rows.reduce((s, r) => s + r.debit, 0);
      const credit = rows.reduce((s, r) => s + r.credit, 0);
      const ecart = Math.round(debit - credit);
      return {
        done: Math.abs(ecart) < 1,
        hint: Math.abs(ecart) < 1
          ? `Balance équilibrée (${debit.toLocaleString("fr-FR")})`
          : `Écart de ${ecart.toLocaleString("fr-FR")} à expliquer`,
      };
    },
  },
  {
    id: "liasse",
    title: "La liasse",
    why: "C'est la sortie attendue par le greffe et l'administration : elle ne vaut que si les cinq étapes précédentes tiennent.",
    href: "/app/liasse",
    cta: "Préparer la liasse",
    evaluate: (db, companyId) => {
      const sessions = companyId ? db.fsSessions.filter((s) => s.companyId === companyId) : db.fsSessions;
      return {
        done: sessions.length > 0,
        hint: sessions.length > 0 ? `${sessions.length} liasse(s) préparée(s)` : "Aucune liasse",
      };
    },
  },
];

/**
 * Calcule le parcours. La première étape non satisfaite devient « à faire
 * maintenant » ; les suivantes restent « à venir » — on ne demande pas de
 * préparer une liasse avant d'avoir des écritures.
 */
export function computeOnboarding(db: DBState, companyId: string | null = null): OnboardingReport {
  const evaluated = STEP_DEFS.map((def, i) => ({ def, order: i + 1, ...def.evaluate(db, companyId) }));
  const firstOpen = evaluated.find((e) => !e.done)?.def.id ?? null;

  const steps: OnboardingStep[] = evaluated.map((e) => ({
    id: e.def.id,
    order: e.order,
    title: e.def.title,
    why: e.def.why,
    hint: e.hint,
    href: e.def.href,
    cta: e.def.cta,
    status: e.done ? "done" : e.def.id === firstOpen ? "current" : "todo",
  }));

  const done = steps.filter((s) => s.status === "done").length;
  const total = steps.length;
  const next = steps.find((s) => s.status === "current") ?? null;
  const summary = done === total
    ? "Parcours complet : entreprise, exercice, écritures, contrôles et liasse tiennent."
    : next
      ? `Étape ${next.order} sur ${total} — ${next.title} : ${next.hint}.`
      : `${done} étape(s) sur ${total}.`;

  return { steps, done, total, next, summary, complete: done === total };
}
