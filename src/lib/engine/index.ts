// ============================================================================
// FIMAAC — Moteur factorisé DRY (DOCUMENT 5)
// BALANCE N + BALANCE N-1 → États → Notes → Fiscalité → Contrôles
//
// ⚠️ RÔLE RÉEL (constaté en P26) : ce moteur n'est importé par **aucun** code de
// l'application — seuls les tests le chargent. Il n'est donc pas une seconde
// source de vérité : c'est un **oracle de contre-vérification**. Les montants
// affichés viennent de `liasseEngine` et `lib/liasse` ; ici, on recalcule
// indépendamment pour vérifier que les deux tombent d'accord (même bilan, même
// TAFIRE, même résultat). Un oracle qui divergerait est un signal d'alarme, pas
// un correctif automatique.
//
// Toute utilisation hors `__tests__` est refusée par
// `src/lib/__tests__/engineOracle.test.ts` : si ce moteur entre un jour en
// production, la décision devra être écrite, pas subie.
// ============================================================================
export * from "./types";
export * from "./soldes";
export * from "./agregateurs";
export * from "./etats";
export * from "./fiscalite";
export * from "./controles";

import type { EngineContext, NormalizedBalance, EngineResult } from "./types";
import { createContext } from "./soldes";
import { buildAllStates } from "./etats";
import { buildFiscalite } from "./fiscalite";
import { runEngineControls } from "./controles";

/**
 * §27 — Pipeline complet du moteur factorisé.
 *
 * 1. Importer Balance N + N-1 (déjà normalisées)
 * 2. Construire le contexte
 * 3. Calculer les états (Bilan/CR/TFT) pour N et N-1
 * 4. Calculer les variations N/N-1
 * 5. Calculer la fiscalité
 * 6. Lancer les contrôles
 * 7. Retourner le résultat complet avec traçabilité
 *
 * @param balanceN   Balance exercice N
 * @param balanceN1  Balance exercice N-1
 * @param accounts   Plan comptable SYSCOHADA
 * @param fiscalOpts Options fiscales (réintégrations, déductions)
 */
export function runEngine(
  balanceN: NormalizedBalance[],
  balanceN1: NormalizedBalance[],
  accounts: { code: string; classNumber: number; label?: string }[],
  fiscalOpts: { reintegrations?: number; deductions?: number } = {},
): EngineResult {
  // §27-03 — Contexte (cache + trace initialisés)
  const ctx: EngineContext = createContext(balanceN, balanceN1, accounts);

  // §27-11/12/13 — États N + N-1 + variations
  const states = buildAllStates(ctx);

  // §27-16 — Fiscalité (réutilise les états)
  const fiscalite = buildFiscalite(ctx, fiscalOpts);

  // §27-17 — Contrôles (réutilise les états + fiscalité)
  const controls = runEngineControls(ctx);

  return {
    context: ctx,
    bilan: states.bilan,
    resultat: states.resultat,
    tft: states.tft,
    variations: states.variations,
    fiscalite,
    controls,
    traceability: ctx.trace,
  };
}
