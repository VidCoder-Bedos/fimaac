// ============================================================================
// FIMAAC — Production Engine : registre des zones financières (P0, §14)
// Matrice "source → calcul → cellule → note → contrôle".
// Chaque zone est identifiée fonctionnellement (id stable) — jamais par coordonnée Excel.
// Alignée sur les références SYSCOHADA (AE, AF, TA, RA…) et RULE_REGISTRY existant.
// ============================================================================
import type { SheetCategory, ZoneDef } from "./types";

/** Identifiants stables de feuilles GUDEF. */
export const SHEETS = {
  BILAN_ACTIF: "BILAN ACTIF",
  BILAN_PASSIF: "BILAN PASSIF",
  RESULTAT: "COMPTE DE RESULTAT",
  TFT: "TFT",
  NOTE: "NOTE",
  FISCAL: "Résultat fiscal",
  CONTROLE: "Contrôle",
} as const;

const MAT = 1_000_000; // seuil de matérialité par défaut (FCFA) — configurable

/** Helper compact pour construire une ZoneDef calculée (poste d'état). */
function calc(
  id: string, sheet: string, ref: string, label: string,
  category: SheetCategory, opts: Partial<ZoneDef> = {},
): ZoneDef {
  return {
    id, sheet, ref, label, category,
    kind: "calculated",
    required: true,
    period: "both",
    materiality: MAT,
    ...opts,
  };
}

/** Helper pour un total / sous-total. */
function total(id: string, sheet: string, label: string, category: SheetCategory, deps: string[], opts: Partial<ZoneDef> = {}): ZoneDef {
  return { id, sheet, label, category, kind: "total", required: true, period: "both", deps, materiality: MAT, ...opts };
}

/** Helper pour une zone de note (placeholder — détail rempli en P1). */
function noteZone(code: string, ref: string, label: string, deps: string[] = []): ZoneDef {
  return {
    id: `note.${code}`,
    sheet: `${code}`,
    ref,
    label,
    category: "NOTE",
    kind: "derived",
    required: false,
    period: "both",
    noteId: code,
    deps,
    materiality: MAT,
  };
}

// ----------------------------------------------------------------------------
// BILAN ACTIF (soldes débiteurs)
// ----------------------------------------------------------------------------
const ACTIF_ZONES: ZoneDef[] = [
  calc("bilan_actif.AE", SHEETS.BILAN_ACTIF, "AE", "Frais de développement et de prospection", "BILAN_ACTIF"),
  calc("bilan_actif.AF", SHEETS.BILAN_ACTIF, "AF", "Brevets, licences, logiciels et droits similaires", "BILAN_ACTIF"),
  calc("bilan_actif.AG", SHEETS.BILAN_ACTIF, "AG", "Fonds commercial et droit au bail", "BILAN_ACTIF"),
  calc("bilan_actif.AH", SHEETS.BILAN_ACTIF, "AH", "Autres immobilisations incorporelles", "BILAN_ACTIF"),
  total("bilan_actif.IMMO_INCORP_NET", SHEETS.BILAN_ACTIF, "Immobilisations incorporelles (net)", "BILAN_ACTIF", ["bilan_actif.AE", "bilan_actif.AF", "bilan_actif.AG", "bilan_actif.AH"], { ruleId: "BILAN.IMMO_NET" }),
  calc("bilan_actif.AJ", SHEETS.BILAN_ACTIF, "AJ", "Terrains", "BILAN_ACTIF"),
  calc("bilan_actif.AK", SHEETS.BILAN_ACTIF, "AK", "Bâtiments, constructions", "BILAN_ACTIF"),
  calc("bilan_actif.AL", SHEETS.BILAN_ACTIF, "AL", "Aménagements, agencements et installations", "BILAN_ACTIF"),
  calc("bilan_actif.AM", SHEETS.BILAN_ACTIF, "AM", "Matériel, mobilier et actifs biologiques", "BILAN_ACTIF"),
  calc("bilan_actif.AN", SHEETS.BILAN_ACTIF, "AN", "Matériel de transport", "BILAN_ACTIF"),
  calc("bilan_actif.AP", SHEETS.BILAN_ACTIF, "AP", "Avances et acomptes versés sur immobilisations", "BILAN_ACTIF"),
  total("bilan_actif.IMMO_CORP_NET", SHEETS.BILAN_ACTIF, "Immobilisations corporelles (net)", "BILAN_ACTIF", ["bilan_actif.AJ", "bilan_actif.AK", "bilan_actif.AL", "bilan_actif.AM", "bilan_actif.AN", "bilan_actif.AP"]),
  calc("bilan_actif.AR", SHEETS.BILAN_ACTIF, "AR", "Titres de participation", "BILAN_ACTIF"),
  calc("bilan_actif.AS", SHEETS.BILAN_ACTIF, "AS", "Autres immobilisations financières", "BILAN_ACTIF"),
  total("bilan_actif.IMMO_FIN_NET", SHEETS.BILAN_ACTIF, "Immobilisations financières (net)", "BILAN_ACTIF", ["bilan_actif.AR", "bilan_actif.AS"]),
  total("bilan_actif.IMMO_NET", SHEETS.BILAN_ACTIF, "TOTAL ACTIF IMMOBILISÉ (net)", "BILAN_ACTIF",
    ["bilan_actif.IMMO_INCORP_NET", "bilan_actif.IMMO_CORP_NET", "bilan_actif.IMMO_FIN_NET"], { ruleId: "BILAN.IMMO_NET" }),
  calc("bilan_actif.BB", SHEETS.BILAN_ACTIF, "BB", "Stocks et en cours", "BILAN_ACTIF", { ruleId: "BILAN.STOCKS" }),
  calc("bilan_actif.BI", SHEETS.BILAN_ACTIF, "BI", "Clients et comptes rattachés", "BILAN_ACTIF", { ruleId: "BILAN.CREANCES", noteId: "NOTE_04" }),
  calc("bilan_actif.BJ", SHEETS.BILAN_ACTIF, "BJ", "Autres créances", "BILAN_ACTIF", { noteId: "NOTE_05" }),
  calc("bilan_actif.BQ", SHEETS.BILAN_ACTIF, "BQ", "Titres de placement", "BILAN_ACTIF"),
  calc("bilan_actif.BR", SHEETS.BILAN_ACTIF, "BR", "Valeurs à encaisser", "BILAN_ACTIF"),
  calc("bilan_actif.BS", SHEETS.BILAN_ACTIF, "BS", "Banque, chèques postaux, caisse et assimilés", "BILAN_ACTIF", { ruleId: "BILAN.TRESORERIE" }),
  calc("bilan_actif.BU", SHEETS.BILAN_ACTIF, "BU", "Écart de conversion actif", "BILAN_ACTIF"),
  total("bilan_actif.TOTAL", SHEETS.BILAN_ACTIF, "GRAND TOTAL ACTIF", "BILAN_ACTIF",
    ["bilan_actif.IMMO_NET", "bilan_actif.BB", "bilan_actif.BI", "bilan_actif.BJ", "bilan_actif.BQ", "bilan_actif.BR", "bilan_actif.BS", "bilan_actif.BU"],
    { ruleId: "BILAN.TOTAL_ACTIF" }),
];

// ----------------------------------------------------------------------------
// BILAN PASSIF (soldes créditeurs)
// ----------------------------------------------------------------------------
const PASSIF_ZONES: ZoneDef[] = [
  calc("bilan_passif.CA", SHEETS.BILAN_PASSIF, "CA", "Capital social", "BILAN_PASSIF"),
  calc("bilan_passif.CB", SHEETS.BILAN_PASSIF, "CB", "Apporteurs capital non appelé", "BILAN_PASSIF"),
  calc("bilan_passif.CD", SHEETS.BILAN_PASSIF, "CD", "Primes liées au capital", "BILAN_PASSIF"),
  calc("bilan_passif.CE", SHEETS.BILAN_PASSIF, "CE", "Écarts de réévaluation", "BILAN_PASSIF"),
  calc("bilan_passif.CF", SHEETS.BILAN_PASSIF, "CF", "Réserves indisponibles", "BILAN_PASSIF"),
  calc("bilan_passif.CG", SHEETS.BILAN_PASSIF, "CG", "Réserves libres", "BILAN_PASSIF"),
  calc("bilan_passif.CH", SHEETS.BILAN_PASSIF, "CH", "Report à nouveau", "BILAN_PASSIF", { noteId: "NOTE_13" }),
  calc("bilan_passif.CJ", SHEETS.BILAN_PASSIF, "CJ", "Résultat de l'exercice", "BILAN_PASSIF", { deps: ["resultat.RESULTAT_NET"] }),
  total("bilan_passif.CAPITAUX", SHEETS.BILAN_PASSIF, "CAPITAUX PROPRES", "BILAN_PASSIF",
    ["bilan_passif.CA", "bilan_passif.CB", "bilan_passif.CD", "bilan_passif.CE", "bilan_passif.CF", "bilan_passif.CG", "bilan_passif.CH", "bilan_passif.CJ"],
    { ruleId: "BILAN.CAPITAUX" }),
  calc("bilan_passif.CL", SHEETS.BILAN_PASSIF, "CL", "Subventions d'investissement", "BILAN_PASSIF"),
  calc("bilan_passif.CM", SHEETS.BILAN_PASSIF, "CM", "Provisions réglementées", "BILAN_PASSIF"),
  calc("bilan_passif.DA", SHEETS.BILAN_PASSIF, "DA", "Emprunts et dettes financières", "BILAN_PASSIF", { ruleId: "BILAN.DETTES_FIN", noteId: "NOTE_16A" }),
  calc("bilan_passif.DB", SHEETS.BILAN_PASSIF, "DB", "Dettes de location-acquisition", "BILAN_PASSIF"),
  calc("bilan_passif.DC", SHEETS.BILAN_PASSIF, "DC", "Provisions pour risques et charges", "BILAN_PASSIF"),
  calc("bilan_passif.DH", SHEETS.BILAN_PASSIF, "DH", "Dettes circulantes HAO", "BILAN_PASSIF"),
  calc("bilan_passif.DI", SHEETS.BILAN_PASSIF, "DI", "Clients - avances reçues", "BILAN_PASSIF"),
  calc("bilan_passif.DJ", SHEETS.BILAN_PASSIF, "DJ", "Fournisseurs d'exploitation", "BILAN_PASSIF", { ruleId: "BILAN.DETTES_FOURN" }),
  calc("bilan_passif.DK", SHEETS.BILAN_PASSIF, "DK", "Dettes fiscales et sociales", "BILAN_PASSIF", { noteId: "NOTE_17" }),
  calc("bilan_passif.DM", SHEETS.BILAN_PASSIF, "DM", "Autres dettes", "BILAN_PASSIF"),
  calc("bilan_passif.DQ", SHEETS.BILAN_PASSIF, "DQ", "Banques, crédits d'escompte", "BILAN_PASSIF"),
  calc("bilan_passif.DR", SHEETS.BILAN_PASSIF, "DR", "Banques, crédits de trésorerie", "BILAN_PASSIF"),
  calc("bilan_passif.DV", SHEETS.BILAN_PASSIF, "DV", "Écart de conversion passif", "BILAN_PASSIF"),
  total("bilan_passif.TOTAL", SHEETS.BILAN_PASSIF, "GRAND TOTAL PASSIF", "BILAN_PASSIF",
    ["bilan_passif.CAPITAUX", "bilan_passif.CL", "bilan_passif.CM", "bilan_passif.DA", "bilan_passif.DB", "bilan_passif.DC", "bilan_passif.DH", "bilan_passif.DI", "bilan_passif.DJ", "bilan_passif.DK", "bilan_passif.DM", "bilan_passif.DQ", "bilan_passif.DR", "bilan_passif.DV"],
    { ruleId: "BILAN.TOTAL_PASSIF" }),
];

// ----------------------------------------------------------------------------
// COMPTE DE RÉSULTAT
// ----------------------------------------------------------------------------
const RESULTAT_ZONES: ZoneDef[] = [
  calc("resultat.TA", SHEETS.RESULTAT, "TA", "Ventes de marchandises", "RESULTAT"),
  calc("resultat.TB", SHEETS.RESULTAT, "TB", "Ventes de produits fabriqués", "RESULTAT"),
  calc("resultat.TC", SHEETS.RESULTAT, "TC", "Travaux, services et produits résiduels vendus", "RESULTAT"),
  calc("resultat.TD", SHEETS.RESULTAT, "TD", "Produits accessoires", "RESULTAT"),
  total("resultat.CA_HT", SHEETS.RESULTAT, "Chiffre d'affaires", "RESULTAT", ["resultat.TA", "resultat.TB", "resultat.TC", "resultat.TD"], { ruleId: "CR.CA", ref: "CA" }),
  calc("resultat.TE", SHEETS.RESULTAT, "TE", "Variation stocks / production stockée", "RESULTAT"),
  calc("resultat.TF", SHEETS.RESULTAT, "TF", "Production immobilisée", "RESULTAT"),
  calc("resultat.TG", SHEETS.RESULTAT, "TG", "Subventions d'exploitation", "RESULTAT"),
  calc("resultat.TH", SHEETS.RESULTAT, "TH", "Autres produits", "RESULTAT"),
  calc("resultat.TK", SHEETS.RESULTAT, "TK", "Revenus financiers et assimilés", "RESULTAT"),
  calc("resultat.TJ", SHEETS.RESULTAT, "TJ", "Reprises d'amortissements et provisions", "RESULTAT"),
  total("resultat.TOTAL_PRODUITS", SHEETS.RESULTAT, "Total produits", "RESULTAT", ["resultat.CA_HT", "resultat.TE", "resultat.TF", "resultat.TG", "resultat.TH", "resultat.TK", "resultat.TJ"], { ruleId: "CR.PRODUITS" }),
  calc("resultat.RA", SHEETS.RESULTAT, "RA", "Achats de marchandises", "RESULTAT"),
  calc("resultat.RB", SHEETS.RESULTAT, "RB", "Variation de stocks de marchandises", "RESULTAT"),
  calc("resultat.RC", SHEETS.RESULTAT, "RC", "Achats de matières et fournitures liées", "RESULTAT"),
  calc("resultat.RE", SHEETS.RESULTAT, "RE", "Autres achats", "RESULTAT"),
  calc("resultat.RG", SHEETS.RESULTAT, "RG", "Transports", "RESULTAT"),
  calc("resultat.RH", SHEETS.RESULTAT, "RH", "Services extérieurs", "RESULTAT"),
  calc("resultat.RI", SHEETS.RESULTAT, "RI", "Impôts et taxes", "RESULTAT"),
  calc("resultat.RJ", SHEETS.RESULTAT, "RJ", "Autres charges", "RESULTAT"),
  calc("resultat.RK", SHEETS.RESULTAT, "RK", "Charges de personnel", "RESULTAT", { noteId: "NOTE_21" }),
  calc("resultat.RM", SHEETS.RESULTAT, "RM", "Frais financiers", "RESULTAT"),
  calc("resultat.RL", SHEETS.RESULTAT, "RL", "Dotations aux amortissements et provisions", "RESULTAT", { noteId: "NOTE_06" }),
  total("resultat.TOTAL_CHARGES", SHEETS.RESULTAT, "Total charges", "RESULTAT",
    ["resultat.RA", "resultat.RB", "resultat.RC", "resultat.RE", "resultat.RG", "resultat.RH", "resultat.RI", "resultat.RJ", "resultat.RK", "resultat.RM", "resultat.RL"],
    { ruleId: "CR.CHARGES" }),
  total("resultat.RESULTAT_NET", SHEETS.RESULTAT, "RÉSULTAT NET DE L'EXERCICE", "RESULTAT",
    ["resultat.TOTAL_PRODUITS", "resultat.TOTAL_CHARGES"], { ruleId: "CR.RESULTAT_NET", ref: "RN" }),
];

// ----------------------------------------------------------------------------
// TFT
// ----------------------------------------------------------------------------
const TFT_ZONES: ZoneDef[] = [
  total("tft.CAF", SHEETS.TFT, "Capacité d'autofinancement", "TFT", ["resultat.RESULTAT_NET", "resultat.RL", "resultat.TJ"], { ruleId: "TFT.CAF", ref: "FA" }),
  total("tft.TRESO_NETTE", SHEETS.TFT, "Trésorerie nette", "TFT", ["bilan_actif.BS", "bilan_passif.DQ", "bilan_passif.DR"], { ruleId: "TFT.TRESO_NETTE" }),
];

// ----------------------------------------------------------------------------
// NOTES 1-35 (placeholders — détail compute en P1 ; structure du graphe en P0)
// ----------------------------------------------------------------------------
const NOTE_ZONES: ZoneDef[] = [
  noteZone("NOTE_01", "1", "Note 1 — Capital et réserves", ["bilan_passif.CA", "bilan_passif.CG"]),
  noteZone("NOTE_03A", "3A", "Note 3A — Immobilisations incorporelles et corporelles", ["bilan_actif.AE", "bilan_actif.AF", "bilan_actif.AG", "bilan_actif.AH", "bilan_actif.AJ", "bilan_actif.AK", "bilan_actif.AL", "bilan_actif.AM", "bilan_actif.AN"]),
  noteZone("NOTE_03B", "3B", "Note 3B — Immobilisations financières", ["bilan_actif.AR", "bilan_actif.AS"]),
  noteZone("NOTE_03C", "3C", "Note 3C — Amortissements", ["resultat.RL"]),
  noteZone("NOTE_04", "4", "Note 4 — Créances clients et comptes rattachés", ["bilan_actif.BI"]),
  noteZone("NOTE_05", "5", "Note 5 — Autres créances", ["bilan_actif.BJ"]),
  noteZone("NOTE_06", "6", "Note 6 — Stocks", ["bilan_actif.BB"]),
  noteZone("NOTE_07", "7", "Note 7 — Autres immobilisations financières", ["bilan_actif.AS"]),
  noteZone("NOTE_08", "8", "Note 8 — Titres de placement", ["bilan_actif.BQ"]),
  noteZone("NOTE_13", "13", "Note 13 — Capitaux propres et réserves", ["bilan_passif.CAPITAUX"]),
  noteZone("NOTE_14", "14", "Note 14 — Emprunts et dettes financières", ["bilan_passif.DA"]),
  noteZone("NOTE_16A", "16A", "Note 16A — Dettes fiscales et sociales", ["bilan_passif.DK"]),
  noteZone("NOTE_17", "17", "Note 17 — Autres dettes", ["bilan_passif.DM"]),
  noteZone("NOTE_21", "21", "Note 21 — Charges de personnel", ["resultat.RK"]),
  noteZone("NOTE_22", "22", "Note 22 — Autres charges", ["resultat.RJ"]),
  noteZone("NOTE_28", "28", "Note 28 — Échéances des créances et des dettes", ["bilan_actif.BI", "bilan_passif.DJ"]),
  noteZone("NOTE_34", "34", "Note 34 — Tableau de financement et ratios", ["tft.CAF", "tft.TRESO_NETTE", "bilan_passif.CAPITAUX"]),
];

// ----------------------------------------------------------------------------
// REGISTRE CENTRAL
// ----------------------------------------------------------------------------
export const ZONE_REGISTRY: ZoneDef[] = [
  ...ACTIF_ZONES, ...PASSIF_ZONES, ...RESULTAT_ZONES, ...TFT_ZONES, ...NOTE_ZONES,
];

/** Index par id (O(1)). */
export const ZONE_BY_ID: Map<string, ZoneDef> = new Map(ZONE_REGISTRY.map((z) => [z.id, z]));

/** Index par référence SYSCOHADA (AE, TA…). */
export const ZONE_BY_REF: Map<string, ZoneDef> = new Map(
  ZONE_REGISTRY.filter((z) => z.ref).map((z) => [z.ref!, z]),
);

export function getZone(id: string): ZoneDef | undefined {
  return ZONE_BY_ID.get(id);
}

export function zoneByRef(ref: string): ZoneDef | undefined {
  return ZONE_BY_REF.get(ref);
}

export function zonesByCategory(category: SheetCategory): ZoneDef[] {
  return ZONE_REGISTRY.filter((z) => z.category === category);
}

/** Zones obligatoires (required=true) — servent au score de complétude (§19). */
export function mandatoryZones(): ZoneDef[] {
  return ZONE_REGISTRY.filter((z) => z.required && z.kind !== "title");
}

/** Zones de notes déclarées (placeholders — P1 alimente le détail). */
export function noteZones(): ZoneDef[] {
  return ZONE_REGISTRY.filter((z) => z.category === "NOTE");
}

/** Statistiques du registre (utile pour le diagnostic). */
export function zoneStats(): { total: number; mandatory: number; byCategory: Record<string, number> } {
  const byCategory: Record<string, number> = {};
  for (const z of ZONE_REGISTRY) byCategory[z.category] = (byCategory[z.category] || 0) + 1;
  return { total: ZONE_REGISTRY.length, mandatory: mandatoryZones().length, byCategory };
}
