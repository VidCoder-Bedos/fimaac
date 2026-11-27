// ============================================================================
// FIMAAC — Règles factorisées SYSCOHADA (DOCUMENT 5 §7-8, §12-16)
// Chaque règle est définie UNE FOIS puis appelée avec period="N" ou period="N-1".
// Les états, notes, annexes et contrôles consomment ces règles — jamais les cellules.
// ============================================================================
import type { EngineContext, Period } from "./types";
import { aggregate } from "./soldes";

// ---- FACTORISATION : chaque fonction accepte (ctx, period) — DRY ----
// Une modification ici se propage automatiquement à TOUS les états qui l'utilisent.

/** §12 — BILAN ACTIF */
export const RULE_IMMO_BRUT = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["2"], p, "debit") - aggregate(ctx, ["28", "29"], p, "credit");

export const RULE_AMORT = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["28", "29"], p, "credit");

export const RULE_IMMO_NET = (ctx: EngineContext, p: Period) =>
  RULE_IMMO_BRUT(ctx, p) - RULE_AMORT(ctx, p);

export const RULE_STOCKS = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["3"], p, "debit");

export const RULE_CREANCES_CLIENTS = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["411", "412", "414", "416", "417", "418"], p, "debit");

export const RULE_AUTRES_CREANCES = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["46"], p, "debit");

export const RULE_TITRES_PLACEMENT = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["50"], p, "debit");

export const RULE_VALEURS_ENCAISSER = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["511"], p, "debit");

export const RULE_BANQUE_CAISSE = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["521", "522", "53", "57"], p, "debit");

export const RULE_ECART_CONV_ACTIF = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["476"], p, "debit");

export const RULE_TOTAL_ACTIF = (ctx: EngineContext, p: Period) =>
  RULE_IMMO_NET(ctx, p) + RULE_STOCKS(ctx, p) +
  RULE_CREANCES_CLIENTS(ctx, p) + RULE_AUTRES_CREANCES(ctx, p) +
  RULE_TITRES_PLACEMENT(ctx, p) + RULE_VALEURS_ENCAISSER(ctx, p) +
  RULE_BANQUE_CAISSE(ctx, p) + RULE_ECART_CONV_ACTIF(ctx, p);

/** §13 — BILAN PASSIF */
export const RULE_CAPITAL_SOCIAL = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["101"], p, "credit");

export const RULE_RESERVES = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["106", "11", "118"], p, "credit") - aggregate(ctx, ["109", "129"], p, "debit");

export const RULE_CAPITAUX_PROPRES = (ctx: EngineContext, p: Period) =>
  RULE_CAPITAL_SOCIAL(ctx, p) + RULE_RESERVES(ctx, p);

export const RULE_RESULTAT_PASSIF = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["120"], p, "credit") - aggregate(ctx, ["121"], p, "debit");

export const RULE_DETTES_FINANCIERES = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["16", "17"], p, "credit");

export const RULE_DETTES_FOURNISSEURS = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["401", "403", "404", "405", "408"], p, "credit");

export const RULE_DETTES_FISCALES_SOCIALES = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["43", "44"], p, "credit");

export const RULE_AUTRES_DETTES = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["464", "469", "465", "48"], p, "credit");

export const RULE_TRESORERIE_PASSIF = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["513", "516", "518", "519"], p, "credit");

export const RULE_ECART_CONV_PASSIF = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["477"], p, "credit");

export const RULE_TOTAL_PASSIF = (ctx: EngineContext, p: Period) =>
  RULE_CAPITAUX_PROPRES(ctx, p) + RULE_RESULTAT_PASSIF(ctx, p) +
  RULE_DETTES_FINANCIERES(ctx, p) + RULE_DETTES_FOURNISSEURS(ctx, p) +
  RULE_DETTES_FISCALES_SOCIALES(ctx, p) + RULE_AUTRES_DETTES(ctx, p) +
  RULE_TRESORERIE_PASSIF(ctx, p) + RULE_ECART_CONV_PASSIF(ctx, p);

/** §14 — COMPTE DE RÉSULTAT (SIG en cascade) */
export const RULE_VENTES_MARCHANDISES = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["701"], p, "credit");

export const RULE_VENTES_PRODUITS = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["702"], p, "credit");

export const RULE_TRAVAUX_SERVICES = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["703", "704", "705", "706"], p, "credit");

export const RULE_PRODUITS_ACCESSOIRES = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["707"], p, "credit");

export const RULE_CHIFFRE_AFFAIRES = (ctx: EngineContext, p: Period) =>
  RULE_VENTES_MARCHANDISES(ctx, p) + RULE_VENTES_PRODUITS(ctx, p) +
  RULE_TRAVAUX_SERVICES(ctx, p) + RULE_PRODUITS_ACCESSOIRES(ctx, p);

export const RULE_VARIATION_STOCKS = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["71"], p, "credit");

export const RULE_PRODUCTION_IMMOBILISEE = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["72"], p, "credit");

export const RULE_SUBVENTIONS_EXPLOIT = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["74"], p, "credit");

export const RULE_AUTRES_PRODUITS = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["75"], p, "credit");

export const RULE_PRODUITS_FINANCIERS = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["76"], p, "credit");

export const RULE_REPRISES_AMORT_PROV = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["78"], p, "credit");

export const RULE_TRANSFER_EXPLOIT = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["791"], p, "credit");

export const RULE_TOTAL_PRODUITS = (ctx: EngineContext, p: Period) =>
  RULE_CHIFFRE_AFFAIRES(ctx, p) + RULE_VARIATION_STOCKS(ctx, p) +
  RULE_PRODUCTION_IMMOBILISEE(ctx, p) + RULE_SUBVENTIONS_EXPLOIT(ctx, p) +
  RULE_AUTRES_PRODUITS(ctx, p) + RULE_PRODUITS_FINANCIERS(ctx, p) +
  RULE_REPRISES_AMORT_PROV(ctx, p) + RULE_TRANSFER_EXPLOIT(ctx, p);

export const RULE_ACHATS_MARCHANDISES = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["601"], p, "debit");

export const RULE_VAR_STOCK_MARCHANDISES = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["6031"], p, "debit");

export const RULE_ACHATS_MATIERES = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["602"], p, "debit");

export const RULE_AUTRES_ACHATS = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["605", "606", "607", "608"], p, "debit");

export const RULE_TRANSPORTS = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["61"], p, "debit");

export const RULE_SERVICES_EXTERIEURS = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["62"], p, "debit");

export const RULE_IMPOTS_TAXES = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["63"], p, "debit");

export const RULE_AUTRES_CHARGES = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["65"], p, "debit");

export const RULE_CHARGES_PERSONNEL = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["64"], p, "debit");

export const RULE_FRAIS_FINANCIERS = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["66"], p, "debit");

export const RULE_DOTATIONS_AMORT_PROV = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["681", "682", "683"], p, "debit");

export const RULE_TOTAL_CHARGES = (ctx: EngineContext, p: Period) =>
  RULE_ACHATS_MARCHANDISES(ctx, p) + RULE_VAR_STOCK_MARCHANDISES(ctx, p) +
  RULE_ACHATS_MATIERES(ctx, p) + RULE_AUTRES_ACHATS(ctx, p) +
  RULE_TRANSPORTS(ctx, p) + RULE_SERVICES_EXTERIEURS(ctx, p) +
  RULE_IMPOTS_TAXES(ctx, p) + RULE_AUTRES_CHARGES(ctx, p) +
  RULE_CHARGES_PERSONNEL(ctx, p) + RULE_FRAIS_FINANCIERS(ctx, p) +
  RULE_DOTATIONS_AMORT_PROV(ctx, p);

export const RULE_RESULTAT_NET = (ctx: EngineContext, p: Period) =>
  RULE_TOTAL_PRODUITS(ctx, p) - RULE_TOTAL_CHARGES(ctx, p);

/** SIG intermédiaires (§14) — Marge → VA → EBE → REX → RF → RAO → RN */
export const RULE_MARGE_COMMERCIALE = (ctx: EngineContext, p: Period) =>
  RULE_CHIFFRE_AFFAIRES(ctx, p) - RULE_ACHATS_MARCHANDISES(ctx, p) - RULE_VAR_STOCK_MARCHANDISES(ctx, p);

export const RULE_VALEUR_AJOUTEE = (ctx: EngineContext, p: Period) =>
  RULE_MARGE_COMMERCIALE(ctx, p) + RULE_VARIATION_STOCKS(ctx, p) +
  RULE_PRODUCTION_IMMOBILISEE(ctx, p) + RULE_AUTRES_PRODUITS(ctx, p) -
  RULE_ACHATS_MATIERES(ctx, p) - RULE_AUTRES_ACHATS(ctx, p) -
  RULE_TRANSPORTS(ctx, p) - RULE_SERVICES_EXTERIEURS(ctx, p);

export const RULE_EBE = (ctx: EngineContext, p: Period) =>
  RULE_VALEUR_AJOUTEE(ctx, p) + RULE_SUBVENTIONS_EXPLOIT(ctx, p) -
  RULE_IMPOTS_TAXES(ctx, p) - RULE_CHARGES_PERSONNEL(ctx, p);

export const RULE_RESULTAT_EXPLOITATION = (ctx: EngineContext, p: Period) =>
  RULE_EBE(ctx, p) - RULE_DOTATIONS_AMORT_PROV(ctx, p) +
  RULE_REPRISES_AMORT_PROV(ctx, p) + RULE_TRANSFER_EXPLOIT(ctx, p);

export const RULE_RESULTAT_FINANCIER = (ctx: EngineContext, p: Period) =>
  RULE_PRODUITS_FINANCIERS(ctx, p) - RULE_FRAIS_FINANCIERS(ctx, p);

export const RULE_RESULTAT_ACTIVITES_ORDINAIRES = (ctx: EngineContext, p: Period) =>
  RULE_RESULTAT_EXPLOITATION(ctx, p) + RULE_RESULTAT_FINANCIER(ctx, p);

/** §15 — TFT */
export const RULE_CAF = (ctx: EngineContext, p: Period) =>
  RULE_RESULTAT_NET(ctx, p) + RULE_DOTATIONS_AMORT_PROV(ctx, p) - RULE_REPRISES_AMORT_PROV(ctx, p);

export const RULE_TRESORERIE_NETTE = (ctx: EngineContext, p: Period) =>
  RULE_BANQUE_CAISSE(ctx, p) - RULE_TRESORERIE_PASSIF(ctx, p);

/** §16 — NOTES (exemples de réutilisation des règles ci-dessus) */
export const RULE_NOTE_IMMO = (ctx: EngineContext, p: Period) => ({
  brut: RULE_IMMO_BRUT(ctx, p),
  amort: RULE_AMORT(ctx, p),
  net: RULE_IMMO_NET(ctx, p),
});

export const RULE_NOTE_RESULTAT = (ctx: EngineContext, p: Period) => ({
  produits: RULE_TOTAL_PRODUITS(ctx, p),
  charges: RULE_TOTAL_CHARGES(ctx, p),
  net: RULE_RESULTAT_NET(ctx, p),
});

/** §26 — Exemple de cascade réutilisable */
export const RULE_COUT_ACHAT = (ctx: EngineContext, p: Period) =>
  RULE_ACHATS_MARCHANDISES(ctx, p) + RULE_VAR_STOCK_MARCHANDISES(ctx, p);

/** Registre central de toutes les règles factorisées (§9) */
export const RULE_REGISTRY: Record<
  string,
  { fn: (ctx: EngineContext, p: Period) => number; name: string; category: string }
> = {
  "BILAN.IMMO_BRUT": { fn: RULE_IMMO_BRUT, name: "Immobilisations brutes", category: "BILAN_ACTIF" },
  "BILAN.AMORT": { fn: RULE_AMORT, name: "Amortissements", category: "BILAN_ACTIF" },
  "BILAN.IMMO_NET": { fn: RULE_IMMO_NET, name: "Immobilisations nettes", category: "BILAN_ACTIF" },
  "BILAN.STOCKS": { fn: RULE_STOCKS, name: "Stocks", category: "BILAN_ACTIF" },
  "BILAN.CREANCES": { fn: RULE_CREANCES_CLIENTS, name: "Créances clients", category: "BILAN_ACTIF" },
  "BILAN.TRESORERIE": { fn: RULE_BANQUE_CAISSE, name: "Banque & caisse", category: "BILAN_ACTIF" },
  "BILAN.TOTAL_ACTIF": { fn: RULE_TOTAL_ACTIF, name: "Total actif", category: "BILAN_ACTIF" },
  "BILAN.CAPITAUX": { fn: RULE_CAPITAUX_PROPRES, name: "Capitaux propres", category: "BILAN_PASSIF" },
  "BILAN.DETTES_FIN": { fn: RULE_DETTES_FINANCIERES, name: "Dettes financières", category: "BILAN_PASSIF" },
  "BILAN.DETTES_FOURN": { fn: RULE_DETTES_FOURNISSEURS, name: "Dettes fournisseurs", category: "BILAN_PASSIF" },
  "BILAN.TOTAL_PASSIF": { fn: RULE_TOTAL_PASSIF, name: "Total passif", category: "BILAN_PASSIF" },
  "CR.CA": { fn: RULE_CHIFFRE_AFFAIRES, name: "Chiffre d'affaires", category: "RESULTAT" },
  "CR.PRODUITS": { fn: RULE_TOTAL_PRODUITS, name: "Total produits", category: "RESULTAT" },
  "CR.CHARGES": { fn: RULE_TOTAL_CHARGES, name: "Total charges", category: "RESULTAT" },
  "CR.RESULTAT_NET": { fn: RULE_RESULTAT_NET, name: "Résultat net", category: "RESULTAT" },
  "CR.MARGE": { fn: RULE_MARGE_COMMERCIALE, name: "Marge commerciale", category: "SIG" },
  "CR.VA": { fn: RULE_VALEUR_AJOUTEE, name: "Valeur ajoutée", category: "SIG" },
  "CR.EBE": { fn: RULE_EBE, name: "Excédent brut d'exploitation", category: "SIG" },
  "CR.REX": { fn: RULE_RESULTAT_EXPLOITATION, name: "Résultat d'exploitation", category: "SIG" },
  "CR.RAO": { fn: RULE_RESULTAT_ACTIVITES_ORDINAIRES, name: "Résultat activités ordinaires", category: "SIG" },
  "TFT.CAF": { fn: RULE_CAF, name: "Capacité d'autofinancement", category: "TFT" },
  "TFT.TRESO_NETTE": { fn: RULE_TRESORERIE_NETTE, name: "Trésorerie nette", category: "TFT" },
};
