// ============================================================================
// FIMAAC — TABLE DE MAPPING UNIQUE « compte → poste d'état financier »
// P0-1 : une seule source de vérité pour le bilan et le compte de résultat.
// Règle de conception : chaque compte est affecté à UN SEUL poste, avec SON
// solde (débit − crédit). L'identité actif = passif découle alors de
// Σ(soldes) = 0, au lieu d'être constatée après coup.
//
// ⚠️ Toute modification doit être confrontée à src/lib/chart.ts (libellés
//    officiels SYSCOHADA) et couverte par src/lib/__tests__/etats.test.ts.
// ============================================================================

/** Postes d'états financiers produits par le mapping. */
export type Poste =
  | "immoBrut" | "amort"
  | "stocks" | "deprecStocks"
  | "creancesClients" | "creancesEtat" | "creancesFiscalesSociales" | "autresCreances" | "deprecTiers"
  | "tresorerie" | "tresoreriePassif"
  | "capitaux" | "reportANouveau" | "resultatPoste"
  | "dettesFin" | "dettesFourn" | "dettesFiscalesSociales" | "autresDettes"
  | "charges" | "produits" | "chargesHAO" | "produitsHAO"
  | "horsBilan";

export type Side = "actif" | "passif" | "resultat" | "hors";
/** Sens de valorisation d'un poste. */
export type Mode = "debitNet" | "creditNet";

export interface MappingRule {
  poste: Poste;
  label: string;
  side: Side;
  prefixes: string[];
  exclude?: string[];
  mode: Mode;
  /** Filtre sur le signe du solde — indispensable quand deux postes se partagent une racine. */
  onlySign?: "positive" | "negative";
  note?: string;
}

/**
 * Table ordonnée : le PREMIER poste dont un préfixe correspond gagne.
 * L'ordre est significatif — les préfixes spécifiques doivent précéder les génériques.
 * Références vérifiées dans src/lib/chart.ts :
 *   409 Fournisseurs débiteurs · 42 Personnel · 43 Organismes sociaux · 44 État
 *   445 TVA récupérable · 4492 Avances sur impôts · 46 Associés · 47 Débiteurs/créditeurs divers
 *   48 Créances et dettes HAO · 49 Dépréciations tiers · 39 Dépréciations stocks
 *   16/17 Emprunts · 19 Provisions financières · 12 Report à nouveau · 13 Résultat net
 *   8 Autres charges et produits (81/82 = cessions) · 9 Engagements hors bilan
 */
export const MAPPING: MappingRule[] = [
  // ---- DETTES FINANCIÈRES (avant la classe 1 générique) ----
  { poste: "dettesFin", label: "Emprunts et dettes financières", side: "passif", prefixes: ["16", "17", "19"], mode: "creditNet", note: "19 = provisions financières pour risques et charges" },

  // ---- RÉSULTAT COMPTABILISÉ & REPORT À NOUVEAU (avant la classe 1 générique) ----
  { poste: "resultatPoste", label: "Résultat net de l'exercice (comptabilisé)", side: "passif", prefixes: ["13"], mode: "creditNet", note: "13 = résultat net ; utilisé s'il est mouvementé, sinon résultat calculé" },
  { poste: "reportANouveau", label: "Report à nouveau", side: "passif", prefixes: ["12", "121"], mode: "creditNet" },

  // ---- CAPITAUX PROPRES ----
  { poste: "capitaux", label: "Capital et réserves", side: "passif", prefixes: ["1"], exclude: ["16", "17", "19", "12", "121", "13"], mode: "creditNet" },

  // ---- ACTIF IMMOBILISÉ ----
  { poste: "amort", label: "Amortissements cumulés", side: "actif", prefixes: ["28", "29"], mode: "creditNet", note: "déduits de l'actif" },
  { poste: "immoBrut", label: "Immobilisations brutes", side: "actif", prefixes: ["2"], exclude: ["28", "29", "39", "49"], mode: "debitNet" },

  // ---- STOCKS ----
  { poste: "deprecStocks", label: "Dépréciations des stocks", side: "actif", prefixes: ["39"], mode: "creditNet" },
  { poste: "stocks", label: "Stocks", side: "actif", prefixes: ["3"], exclude: ["39"], mode: "debitNet" },

  // ---- CRÉANCES ----
  { poste: "deprecTiers", label: "Dépréciations des créances", side: "actif", prefixes: ["49"], mode: "creditNet" },
  { poste: "creancesClients", label: "Créances clients", side: "actif", prefixes: ["409", "411", "412", "414", "416", "417", "418"], mode: "debitNet" },
  { poste: "creancesEtat", label: "Créances sur l'État (TVA récupérable…)", side: "actif", prefixes: ["445", "4492"], mode: "debitNet" },
  { poste: "creancesFiscalesSociales", label: "Créances sociales et fiscales", side: "actif", prefixes: ["42", "43", "44"], exclude: ["445", "4492"], mode: "debitNet", onlySign: "positive" },
  { poste: "autresCreances", label: "Autres créances", side: "actif", prefixes: ["46", "47", "48"], exclude: ["476", "477"], mode: "debitNet", onlySign: "positive" },

  // ---- FOURNISSEURS ----
  { poste: "dettesFourn", label: "Dettes fournisseurs", side: "passif", prefixes: ["40"], exclude: ["409"], mode: "creditNet" },

  // ---- DETTES FISCALES ET SOCIALES ----
  // P15 — un compte 42/43/44 **débiteur** (impôt payé d'avance, cotisations à
  // recevoir, avance au personnel) n'est pas une dette : présenté en diminution
  // des dettes fiscales et sociales, il faussait le passif et disparaissait de
  // l'actif. Le signe décide du côté du bilan, jamais le préfixe seul.
  { poste: "dettesFiscalesSociales", label: "Dettes fiscales et sociales", side: "passif", prefixes: ["42", "43", "44"], exclude: ["445", "4492"], mode: "creditNet", onlySign: "negative" },

  // ---- AUTRES DETTES (même racine que les autres créances → split par signe) ----
  { poste: "autresDettes", label: "Autres dettes", side: "passif", prefixes: ["46", "47", "48"], exclude: ["476", "477"], mode: "creditNet", onlySign: "negative" },

  // ---- TRÉSORERIE ----
  { poste: "tresorerie", label: "Trésorerie (actif)", side: "actif", prefixes: ["5"], mode: "debitNet", onlySign: "positive" },
  { poste: "tresoreriePassif", label: "Trésorerie (passif)", side: "passif", prefixes: ["5"], mode: "creditNet", onlySign: "negative" },

  // ---- COMPTE DE RÉSULTAT ----
  { poste: "charges", label: "Charges des activités ordinaires", side: "resultat", prefixes: ["6"], mode: "debitNet" },
  { poste: "produits", label: "Produits des activités ordinaires", side: "resultat", prefixes: ["7"], mode: "creditNet" },
  { poste: "chargesHAO", label: "Charges hors activités ordinaires (classe 8)", side: "resultat", prefixes: ["8"], mode: "debitNet", onlySign: "positive" },
  { poste: "produitsHAO", label: "Produits hors activités ordinaires (classe 8)", side: "resultat", prefixes: ["8"], mode: "creditNet", onlySign: "negative" },

  // ---- ENGAGEMENTS HORS BILAN (suivis, jamais dans l'actif/passif) ----
  { poste: "horsBilan", label: "Engagements hors bilan", side: "hors", prefixes: ["9"], mode: "creditNet" },
];

export const POSTE_LABELS: Record<Poste, string> = MAPPING.reduce(
  (acc, r) => ({ ...acc, [r.poste]: r.label }),
  {} as Record<Poste, string>,
);

/** Ligne de balance minimale attendue (compatible BalanceRow de liasse). */
export interface MappingRow {
  code: string;
  debit: number;
  credit: number;
}

export interface MappingResult {
  postes: Record<Poste, number>;
  /** Comptes dont le solde est non nul et qui n'ont reçu aucun poste. */
  nonMappes: { code: string; solde: number }[];
  /** Σ des soldes non mappés : l'écart de bilan doit lui être égal (au signe près). */
  ecartNonMappe: number;
  /** Somme des soldes de tous les comptes (doit valoir 0 sur une balance équilibrée). */
  sommeSoldes: number;
}

function emptyPostes(): Record<Poste, number> {
  return {
    immoBrut: 0, amort: 0, stocks: 0, deprecStocks: 0,
    creancesClients: 0, creancesEtat: 0, creancesFiscalesSociales: 0, autresCreances: 0, deprecTiers: 0,
    tresorerie: 0, tresoreriePassif: 0, capitaux: 0, reportANouveau: 0,
    resultatPoste: 0, dettesFin: 0, dettesFourn: 0, dettesFiscalesSociales: 0,
    autresDettes: 0, charges: 0, produits: 0, chargesHAO: 0, produitsHAO: 0, horsBilan: 0,
  };
}

/**
 * Trouve la règle applicable à un compte, en tenant compte des exclusions
 * et du filtre de signe (le solde est requis pour ce dernier).
 */
export function classify(code: string, solde: number): MappingRule | null {
  const c = (code || "").trim();
  if (!c) return null;
  for (const rule of MAPPING) {
    if (rule.exclude?.some((p) => c === p || c.startsWith(p))) continue;
    if (!rule.prefixes.some((p) => c === p || c.startsWith(p))) continue;
    if (rule.onlySign === "positive" && solde <= 0) continue;
    if (rule.onlySign === "negative" && solde >= 0) continue;
    return rule;
  }
  return null;
}

/** Codes dont le solde est non nul et qu'aucune règle ne couvre. */
export function unmappedCodes(rows: MappingRow[]): string[] {
  const out: string[] = [];
  for (const r of rows) {
    const solde = (r.debit || 0) - (r.credit || 0);
    if (solde === 0) continue;
    if (!classify(r.code, solde)) out.push(r.code);
  }
  return out;
}

/**
 * Calcule tous les postes à partir d'une balance.
 * Chaque compte alimente exactement un poste, avec son solde :
 *   mode "debitNet"  → +solde
 *   mode "creditNet" → −solde
 * Aucun montant n'est déduit : un compte non couvert est signalé.
 */
export function computePostes(rows: MappingRow[]): MappingResult {
  const postes = emptyPostes();
  const nonMappes: { code: string; solde: number }[] = [];
  let sommeSoldes = 0;

  for (const r of rows) {
    const debit = Number(r.debit) || 0;
    const credit = Number(r.credit) || 0;
    const solde = debit - credit;
    sommeSoldes += solde;
    if (solde === 0) continue;

    const rule = classify(r.code, solde);
    if (!rule) {
      nonMappes.push({ code: (r.code || "").trim(), solde });
      continue;
    }
    postes[rule.poste] += rule.mode === "debitNet" ? solde : -solde;
  }

  const ecartNonMappe = nonMappes.reduce((s, x) => s + x.solde, 0);
  return { postes, nonMappes, ecartNonMappe, sommeSoldes };
}

/** Arrondi monétaire (la devise XOF n'a pas de subdivision utilisée). */
export function money(n: number): number {
  return Math.round(n);
}
