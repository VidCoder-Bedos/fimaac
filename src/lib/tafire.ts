// ============================================================================
// FIMAAC — TAFIRE (Tableau des flux de trésorerie, SYSCOHADA révisé)
//
// Constat d'audit : la liasse imprimée s'arrêtait au bilan et au compte de
// résultat. Le TAFIRE — obligatoire dans le modèle GUDEF — manquait, alors que
// la page Liasse importe déjà la **balance N-1** (`prev`) et ne s'en servait
// que pour le remplissage Excel.
//
// Principe : aucun flux n'est saisi. Tout est déduit de la variation des
// soldes entre la balance d'ouverture et la balance de clôture, puis réconcilié
// avec la trésorerie réelle :
//
//   trésorerie de clôture = trésorerie d'ouverture
//                         + CAFG
//                         − variation du BFR
//                         − flux d'investissement
//                         + flux de financement
//
// Si l'écart n'est pas nul, c'est la ligne qui est fausse — et on le dit.
// ============================================================================
import type { BalanceRow } from "./liasse";

export interface TafireFlux {
  label: string;
  amount: number;
  /** Comptes ou agrégats justifiant le montant. */
  basis: string;
}

export interface TafireZone {
  id: "a" | "b" | "c";
  label: string;
  fluxes: TafireFlux[];
  total: number;
}

export interface TafireControl {
  id: string;
  label: string;
  level: "ok" | "warning" | "blocking";
  detail: string;
}

export interface Tafire {
  available: boolean;
  /** Raison de l'indisponibilité, quand elle existe. */
  reason?: string;
  zones: TafireZone[];
  cafg: number;
  variationBfr: number;
  tresorerieOuverture: number;
  tresorerieCloture: number;
  tresorerieCalculee: number;
  /** trésorerie calculée − trésorerie réelle. */
  ecart: number;
  controls: TafireControl[];
  blockingCount: number;
  warningCount: number;
}

const round = (n: number) => Math.round(n);

/** Solde net (débit − crédit) des comptes dont le code commence par l'un des préfixes. */
export function balanceOf(rows: BalanceRow[], prefixes: string[]): number {
  let total = 0;
  for (const r of rows) {
    if (!prefixes.some((p) => String(r.code).startsWith(p))) continue;
    total += (Number(r.debit) || 0) - (Number(r.credit) || 0);
  }
  return total;
}

/** Solde net algébrique : + pour l'actif (débit), − pour le passif (crédit). */
const netDebit = (rows: BalanceRow[], prefixes: string[]) => balanceOf(rows, prefixes);

const ACCOUNTS = {
  /** Trésorerie : banques, caisses, mobiliers de placement. */
  treso: ["52", "53", "54", "57"],
  /** Stocks bruts et dépréciations. */
  stocks: ["3"],
  /** Immobilisations brutes. */
  immo: ["2"],
  /** Amortissements et dépréciations d'immobilisations. */
  amort: ["28", "29"],
  /** Dettes financières. */
  dettesFin: ["16", "17"],
  /** Capitaux propres hors résultat (13 exclu : le résultat est déjà dans la CAFG). */
  capitaux: ["10", "11", "12", "14", "15"],
} as const;

export interface WorkingCapitalSplit {
  stocks: number;
  creances: number;
  dettes: number;
  /** stocks + créances − dettes */
  bfr: number;
}

/**
 * BFR ventilé sans double compte : les comptes de stocks (classe 3) et de tiers
 * (40 à 48) sont agrégés par compte, puis classés **par le sens de leur solde**
 * — un solde débiteur est une créance, un solde créditeur une dette. Additionner
 * des préfixes « clients » et « fournisseurs » revenait sinon à compter deux
 * fois les comptes mixtes (419, 421, 431, 443/445…).
 */
export function workingCapital(rows: BalanceRow[]): WorkingCapitalSplit {
  const byAccount = new Map<string, number>();
  for (const r of rows) {
    const code = String(r.code);
    if (!/^(3|4[0-8])/.test(code)) continue;
    byAccount.set(code, (byAccount.get(code) ?? 0) + (Number(r.debit) || 0) - (Number(r.credit) || 0));
  }
  let stocks = 0;
  let creances = 0;
  let dettes = 0;
  for (const [code, net] of byAccount) {
    if (code.startsWith("3")) {
      stocks += net;
    } else if (net > 0) {
      creances += net;
    } else {
      dettes += -net;
    }
  }
  stocks = round(stocks);
  creances = round(creances);
  dettes = round(dettes);
  return { stocks, creances, dettes, bfr: round(stocks + creances - dettes) };
}

/**
 * Construit le TAFIRE à partir des balances d'ouverture (N-1) et de clôture (N).
 * Une balance d'ouverture absente n'est pas comblée par des zéros : le tableau
 * est déclaré non calculable, avec le motif.
 */
export function buildTafire(opening: BalanceRow[] | null | undefined, closing: BalanceRow[]): Tafire {
  const tresoOUV = round(netDebit(opening ?? [], [...ACCOUNTS.treso]));
  const tresoCLO = round(netDebit(closing, [...ACCOUNTS.treso]));

  if (!opening || opening.length === 0) {
    return {
      available: false,
      reason:
        "Balance N-1 non importée : les variations (BFR, investissements, financements) ne peuvent pas être calculées. Importez la balance de l'exercice précédent pour produire le TAFIRE.",
      zones: [],
      cafg: 0,
      variationBfr: 0,
      tresorerieOuverture: 0,
      tresorerieCloture: tresoCLO,
      tresorerieCalculee: 0,
      ecart: 0,
      controls: [
        {
          id: "ouverture",
          label: "Balance d'ouverture disponible",
          level: "blocking",
          detail: "Le TAFIRE n'est pas calculable sans balance N-1. Aucun montant n'est inventé.",
        },
        {
          id: "treso",
          label: "Trésorerie de clôture",
          level: "ok",
          detail: `Trésorerie de clôture constatée : ${tresoCLO} FCFA (comptes 52/53/54/57).`,
        },
      ],
      blockingCount: 1,
      warningCount: 0,
    };
  }

  // --- Résultat net de l'exercice ---
  const produits = -netDebit(closing, ["7"]);
  const charges = netDebit(closing, ["6"]);
  const resultat = round(produits - charges);

  // --- CAFG : résultat + dotations non décaissées (variation des amortissements
  //     et provisions), sans double compte ---
  const amortOUV = -netDebit(opening, [...ACCOUNTS.amort]);
  const amortCLO = -netDebit(closing, [...ACCOUNTS.amort]);
  const dotationsNettes = round(amortCLO - amortOUV);
  const cafg = round(resultat + dotationsNettes);

  // --- Variation du BFR ---
  const wcOUV = workingCapital(opening);
  const wcCLO = workingCapital(closing);
  const varStocks = round(wcCLO.stocks - wcOUV.stocks);
  const varCreances = round(wcCLO.creances - wcOUV.creances);
  const varDettes = round(wcCLO.dettes - wcOUV.dettes);
  const variationBfr = round(wcCLO.bfr - wcOUV.bfr);

  // --- Investissement : variation des immobilisations brutes ---
  const immoOUV = netDebit(opening, ["2"]) + amortOUV;
  const immoCLO = netDebit(closing, ["2"]) + amortCLO;
  const acquisitionsNettes = round(immoCLO - immoOUV);

  // --- Financement : capitaux propres (hors résultat) et dettes financières ---
  const capOUV = -netDebit(opening, [...ACCOUNTS.capitaux]);
  const capCLO = -netDebit(closing, [...ACCOUNTS.capitaux]);
  const varCapital = round(capCLO - capOUV);
  const dettesFinOUV = -netDebit(opening, [...ACCOUNTS.dettesFin]);
  const dettesFinCLO = -netDebit(closing, [...ACCOUNTS.dettesFin]);
  const varDettesFin = round(dettesFinCLO - dettesFinOUV);

  const zoneA: TafireZone = {
    id: "a",
    label: "Zone A — Activités opérationnelles",
    fluxes: [
      { label: "Capacité d'autofinancement globale (CAFG)", amount: cafg, basis: `Résultat ${resultat} + dotations nettes ${dotationsNettes}` },
      { label: "Variation du besoin en fonds de roulement", amount: -variationBfr, basis: `Stocks ${varStocks} + créances ${varCreances} − dettes ${varDettes}` },
    ],
    total: round(cafg - variationBfr),
  };

  const zoneB: TafireZone = {
    id: "b",
    label: "Zone B — Activités d'investissement",
    fluxes: [
      { label: "Acquisitions d'immobilisations (nettes des cessions)", amount: -acquisitionsNettes, basis: `Immobilisations brutes : ${immoOUV} → ${immoCLO}` },
    ],
    total: round(-acquisitionsNettes),
  };

  const zoneC: TafireZone = {
    id: "c",
    label: "Zone C — Activités de financement",
    fluxes: [
      { label: "Augmentation de capital et apports", amount: varCapital, basis: `Capitaux propres (hors résultat) : ${capOUV} → ${capCLO}` },
      { label: "Variation des dettes financières", amount: varDettesFin, basis: `Emprunts et dettes financières : ${dettesFinOUV} → ${dettesFinCLO}` },
    ],
    total: round(varCapital + varDettesFin),
  };

  const tresorerieCalculee = round(tresoOUV + zoneA.total + zoneB.total + zoneC.total);
  const ecart = round(tresorerieCalculee - tresoCLO);

  const controls: TafireControl[] = [
    {
      id: "bouclage",
      label: "Bouclage du tableau (trésorerie calculée = trésorerie réelle)",
      level: Math.abs(ecart) <= 1 ? "ok" : "blocking",
      detail:
        Math.abs(ecart) <= 1
          ? `Trésorerie d'ouverture ${tresoOUV} + flux ${round(zoneA.total + zoneB.total + zoneC.total)} = ${tresoCLO}.`
          : `Écart de ${ecart} FCFA : un flux est mal classé ou une variation manque. Le tableau n'est pas publiable en l'état.`,
    },
    {
      id: "ouverture",
      label: "Trésorerie d'ouverture rapprochée de la balance N-1",
      level: "ok",
      detail: `Comptes 52/53/54/57 au bilan N-1 : ${tresoOUV} FCFA.`,
    },
    {
      id: "dotations",
      label: "Dotations non décaissées",
      level: dotationsNettes >= 0 ? "ok" : "warning",
      detail: dotationsNettes >= 0
        ? `Amortissements et provisions en hausse de ${dotationsNettes} FCFA, réintégrés dans la CAFG.`
        : `Amortissements et provisions en baisse de ${Math.abs(dotationsNettes)} FCFA (reprises) : la CAFG est diminuée d'autant.`,
    },
    {
      id: "immo",
      label: "Investissement déduit de la variation des immobilisations",
      level: "warning",
      detail:
        "Les cessions ne sont pas isolées faute de prix de cession dans la balance : le flux est présenté net des cessions.",
    },
  ];

  return {
    available: true,
    zones: [zoneA, zoneB, zoneC],
    cafg,
    variationBfr,
    tresorerieOuverture: tresoOUV,
    tresorerieCloture: tresoCLO,
    tresorerieCalculee,
    ecart,
    controls,
    blockingCount: controls.filter((c) => c.level === "blocking").length,
    warningCount: controls.filter((c) => c.level === "warning").length,
  };
}

/**
 * Explication lisible du bouclage, pour le document imprimé.
 * Une ligne par agrégat, dans l'ordre du tableau.
 */
export function tafireLines(t: Tafire): { label: string; amount: number; strong?: boolean }[] {
  if (!t.available) {
    return [
      { label: "TAFIRE non calculable — balance N-1 manquante", amount: 0, strong: true },
      { label: "Trésorerie de clôture constatée", amount: t.tresorerieCloture, strong: true },
    ];
  }
  return [
    { label: "Trésorerie d'ouverture", amount: t.tresorerieOuverture, strong: true },
    ...t.zones.flatMap((z) => [
      { label: z.label, amount: 0, strong: true },
      ...z.fluxes.map((f) => ({ label: f.label, amount: f.amount })),
      { label: "Total de la zone", amount: z.total, strong: true },
    ]),
    { label: "Trésorerie de clôture (calculée)", amount: t.tresorerieCalculee, strong: true },
    { label: "Trésorerie de clôture (balance)", amount: t.tresorerieCloture },
  ];
}
