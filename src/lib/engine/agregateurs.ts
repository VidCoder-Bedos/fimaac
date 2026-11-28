// ============================================================================
// FIMAAC — Règles factorisées SYSCOHADA (DOCUMENT 5 §7-8, §12-16)
// Chaque règle est définie UNE FOIS puis appelée avec period="N" ou period="N-1".
// Les états, notes, annexes et contrôles consomment ces règles — jamais les cellules.
// ============================================================================
import type { EngineContext, Period } from "./types";
import { aggregate, aggregateExcept, aggregateSigned } from "./soldes";

// ---- FACTORISATION : chaque fonction accepte (ctx, period) — DRY ----
// Une modification ici se propage automatiquement à TOUS les états qui l'utilisent.

/** §12 — BILAN ACTIF */
// P0-1 : les comptes 28/29 portent déjà un solde créditeur — les retirer de
// l'agrégat suffit. L'ancienne version les déduisait une seconde fois (D-01).
export const RULE_IMMO_BRUT = (ctx: EngineContext, p: Period) =>
  aggregateExcept(ctx, ["2"], ["28", "29", "39", "49"], p, "debit");

export const RULE_AMORT = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["28", "29"], p, "credit");

export const RULE_IMMO_NET = (ctx: EngineContext, p: Period) =>
  RULE_IMMO_BRUT(ctx, p) - RULE_AMORT(ctx, p);

export const RULE_STOCKS = (ctx: EngineContext, p: Period) =>
  aggregateExcept(ctx, ["3"], ["39"], p, "debit");

/** Dépréciations des stocks (39) — déduites de l'actif. */
export const RULE_DEPREC_STOCKS = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["39"], p, "credit");

export const RULE_CREANCES_CLIENTS = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["409", "411", "412", "414", "416", "417", "418"], p, "debit");

/** Créances sur l'État : TVA récupérable (445) et avances sur impôts (4492). */
export const RULE_CREANCES_ETAT = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["445", "4492"], p, "debit");

/** Dépréciations des créances (49) — déduites de l'actif. */
export const RULE_DEPREC_CREANCES = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["49"], p, "credit");

export const RULE_AUTRES_CREANCES = (ctx: EngineContext, p: Period) =>
  aggregateExcept(ctx, ["46", "47", "48"], ["476", "477"], p, "debit");

export const RULE_TITRES_PLACEMENT = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["50"], p, "debit");

export const RULE_VALEURS_ENCAISSER = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["511"], p, "debit");

export const RULE_BANQUE_CAISSE = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["521", "522", "53", "57"], p, "debit");

export const RULE_ECART_CONV_ACTIF = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["476"], p, "debit");

// P0-1 (D-02) : le total est la somme EXACTE des composantes exposées par le
// bilan (immoNet, stocks, créances, trésorerie). Aucune règle autonome.
export const RULE_TOTAL_ACTIF = (ctx: EngineContext, p: Period) =>
  RULE_IMMO_NET(ctx, p)
  + (RULE_STOCKS(ctx, p) - RULE_DEPREC_STOCKS(ctx, p))
  + (RULE_CREANCES_CLIENTS(ctx, p) + RULE_CREANCES_ETAT(ctx, p) +
     RULE_CREANCES_FISCALES_SOCIALES(ctx, p) +
     RULE_AUTRES_CREANCES(ctx, p) - RULE_DEPREC_CREANCES(ctx, p))
  + (RULE_TITRES_PLACEMENT(ctx, p) + RULE_VALEURS_ENCAISSER(ctx, p) +
     RULE_BANQUE_CAISSE(ctx, p) + RULE_ECART_CONV_ACTIF(ctx, p));

/** §13 — BILAN PASSIF */
export const RULE_CAPITAL_SOCIAL = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["101"], p, "credit");

export const RULE_RESERVES = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["106", "11", "118"], p, "credit") - aggregate(ctx, ["109", "129"], p, "debit");

export const RULE_CAPITAUX_PROPRES = (ctx: EngineContext, p: Period) =>
  RULE_CAPITAL_SOCIAL(ctx, p) + RULE_RESERVES(ctx, p) +
  aggregate(ctx, ["12", "121"], p, "credit");

// P0-1 (D-03) : 13 = résultat net comptabilisé (exercice déjà clôturé).
// Sur un exercice en cours, 13 est vide : on retombe sur le résultat calculé,
// jamais sur 0 — sinon le passif ne peut pas s'équilibrer.
export const RULE_RESULTAT_POSTE = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["13"], p, "credit");

export const RULE_RESULTAT_PASSIF = (ctx: EngineContext, p: Period) => {
  const poste = RULE_RESULTAT_POSTE(ctx, p);
  return poste !== 0 ? poste : RULE_RESULTAT_NET(ctx, p);
};

export const RULE_DETTES_FINANCIERES = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["16", "17"], p, "credit");

export const RULE_DETTES_FOURNISSEURS = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["401", "403", "404", "405", "408"], p, "credit");

// P15 — le sens du solde décide du côté du bilan : seuls les soldes créditeurs
// sont des dettes ; les soldes débiteurs sont des créances (voir ci-dessous).
export const RULE_DETTES_FISCALES_SOCIALES = (ctx: EngineContext, p: Period) =>
  aggregateSigned(ctx, ["42", "43", "44"], ["445", "4492"], p, "credit");

/** Créances sociales et fiscales : 42/43/44 à solde débiteur. */
export const RULE_CREANCES_FISCALES_SOCIALES = (ctx: EngineContext, p: Period) =>
  aggregateSigned(ctx, ["42", "43", "44"], ["445", "4492"], p, "debit");

export const RULE_AUTRES_DETTES = (ctx: EngineContext, p: Period) =>
  aggregateExcept(ctx, ["46", "47", "48"], ["476", "477"], p, "credit");

export const RULE_TRESORERIE_PASSIF = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["513", "516", "518", "519"], p, "credit");

export const RULE_ECART_CONV_PASSIF = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["477"], p, "credit");

export const RULE_TOTAL_PASSIF = (ctx: EngineContext, p: Period) =>
  RULE_CAPITAUX_PROPRES(ctx, p) + RULE_RESULTAT_PASSIF(ctx, p) +
  RULE_DETTES_FINANCIERES(ctx, p) + RULE_DETTES_FOURNISSEURS(ctx, p) +
  RULE_DETTES_FISCALES_SOCIALES(ctx, p) + RULE_AUTRES_DETTES(ctx, p) +
  RULE_TRESORERIE_PASSIF(ctx, p) + RULE_ECART_CONV_PASSIF(ctx, p);

/** Charges hors activités ordinaires (classe 8) : 81, 83, 85, 87 et divers. */
export const RULE_CHARGES_HAO = (ctx: EngineContext, p: Period) =>
  aggregateExcept(ctx, ["8"], ["82", "84", "86", "88"], p, "debit");

/** Produits hors activités ordinaires (classe 8) : 82, 84, 86, 88 et divers. */
export const RULE_PRODUITS_HAO = (ctx: EngineContext, p: Period) =>
  aggregateExcept(ctx, ["8"], ["81", "83", "85", "87"], p, "credit");

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
  RULE_REPRISES_AMORT_PROV(ctx, p) + RULE_TRANSFER_EXPLOIT(ctx, p) +
  RULE_PRODUITS_HAO(ctx, p);

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

// P0-1 (D-29) : le plan embarqué donne 62 + 63 = services extérieurs A et B,
// 64 = impôts et taxes, 66 = charges de personnel, 67 = frais financiers.
export const RULE_SERVICES_EXTERIEURS = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["62", "63"], p, "debit");

export const RULE_IMPOTS_TAXES = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["64"], p, "debit");

export const RULE_AUTRES_CHARGES = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["65"], p, "debit");

export const RULE_CHARGES_PERSONNEL = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["66"], p, "debit");

export const RULE_FRAIS_FINANCIERS = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["67"], p, "debit");

export const RULE_DOTATIONS_AMORT_PROV = (ctx: EngineContext, p: Period) =>
  aggregate(ctx, ["68", "69"], p, "debit");

export const RULE_TOTAL_CHARGES = (ctx: EngineContext, p: Period) =>
  RULE_ACHATS_MARCHANDISES(ctx, p) + RULE_VAR_STOCK_MARCHANDISES(ctx, p) +
  RULE_ACHATS_MATIERES(ctx, p) + RULE_AUTRES_ACHATS(ctx, p) +
  RULE_TRANSPORTS(ctx, p) + RULE_SERVICES_EXTERIEURS(ctx, p) +
  RULE_IMPOTS_TAXES(ctx, p) + RULE_AUTRES_CHARGES(ctx, p) +
  RULE_CHARGES_PERSONNEL(ctx, p) + RULE_FRAIS_FINANCIERS(ctx, p) +
  RULE_DOTATIONS_AMORT_PROV(ctx, p) + RULE_CHARGES_HAO(ctx, p);

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
