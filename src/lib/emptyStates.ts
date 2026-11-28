// ============================================================================
// FIMAAC — Écrans vides : dire ce qui manque (P24)
//
// Constat d'audit (§D) : les écrans vides disaient « Aucune écriture », « Aucune
// déclaration », « Importez une balance » — c'est-à-dire ce qu'on **voit déjà**.
// Aucun ne disait *pourquoi il n'y a rien à voir ici* ni *ce qu'il faut faire
// avant*. Un nouvel utilisateur pouvait ouvrir la liasse d'un dossier sans
// exercice et lire « importez une balance » : le vrai manque était ailleurs.
//
// Ici, chaque écran déclare ses **prérequis** (les mêmes six étapes que le
// parcours d'amorçage) ; le premier qui manque est nommé, avec son chiffre et
// son lien. Aucune étape inventée : la vérité vient d'un seul endroit.
// ============================================================================

import { computeOnboarding, type OnboardingReport, type OnboardingStep } from "./onboarding";
import type { DBState } from "./types";

export type ScreenId = "ecritures" | "liasse" | "fiscalite" | "etats" | "paie" | "banque" | "note";

/** Ce qu'un écran exige avant de pouvoir montrer quelque chose d'utile. */
export const SCREEN_PREREQUISITES: Record<ScreenId, string[]> = {
  ecritures: ["entreprise", "exercice"],
  fiscalite: ["entreprise", "exercice", "ecritures"],
  liasse: ["entreprise", "exercice", "ecritures", "controles"],
  etats: ["entreprise", "exercice", "ecritures"],
  paie: ["entreprise", "exercice"],
  banque: ["entreprise"],
  note: ["entreprise", "exercice"],
};

export const SCREEN_LABELS: Record<ScreenId, string> = {
  ecritures: "les écritures",
  fiscalite: "la fiscalité",
  liasse: "la liasse",
  etats: "les comptes annuels",
  paie: "la paie",
  banque: "le rapprochement bancaire",
  note: "cette note",
};

export interface MissingStep {
  step: OnboardingStep;
  /** Phrase courte, prête à afficher sous un écran vide. */
  message: string;
  href: string;
  cta: string;
}

/**
 * Renvoie le premier prérequis manquant pour un écran, ou `null` si l'écran a
 * tout ce qu'il lui faut (auquel cas son vide est un vrai vide, pas un manque).
 */
export function explainMissing(screen: ScreenId, report: OnboardingReport): MissingStep | null {
  const required = SCREEN_PREREQUISITES[screen];
  for (const id of required) {
    const step = report.steps.find((s) => s.id === id);
    if (step && step.status !== "done") {
      return {
        step,
        message: `Pour ${SCREEN_LABELS[screen]}, il manque d'abord : ${step.title.toLowerCase()} — ${step.hint.toLowerCase()}.`,
        href: step.href,
        cta: step.cta,
      };
    }
  }
  return null;
}

/** Raccourci pour les écrans qui n'ont que la base de données sous la main. */
export function missingFor(screen: ScreenId, db: DBState, companyId: string | null): MissingStep | null {
  return explainMissing(screen, computeOnboarding(db, companyId));
}
