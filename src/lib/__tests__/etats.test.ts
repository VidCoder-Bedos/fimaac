/**
 * P0-1 — Recette du moteur d'états financiers.
 *
 * La « balance de contrôle » ci-dessous est calculable à la main :
 *   ACTIF  = immo nettes 4 000 000 + stocks 2 000 000 + clients 3 000 000
 *            + TVA récupérable 200 000 + banque 4 000 000            = 13 200 000
 *   PASSIF = capital 7 300 000 + résultat 3 000 000 + fournisseurs 2 000 000
 *            + dettes fiscales et sociales 900 000                    = 13 200 000
 * Aucune valeur n'est déduite d'une implémentation : elles sont posées à la main.
 */
import { describe, it, expect } from "vitest";
import { buildStatements, runChecks, type BalanceRow } from "../liasse";
import { runEngine } from "../engine";
import { CHART_OF_ACCOUNTS } from "../chart";
import { computePostes, unmappedCodes } from "../etatsMapping";
import { seedDatabase } from "../seed";
import { trialBalance } from "../accounting";

const CONTROLE: BalanceRow[] = [
  { code: "101", label: "Capital social", debit: 0, credit: 7_300_000 },
  { code: "2411", label: "Matériel industriel", debit: 5_000_000, credit: 0 },
  { code: "2841", label: "Amortissements du matériel", debit: 0, credit: 1_000_000 },
  { code: "311", label: "Marchandises", debit: 2_000_000, credit: 0 },
  { code: "411", label: "Clients", debit: 3_000_000, credit: 0 },
  { code: "521", label: "Banque", debit: 4_000_000, credit: 0 },
  { code: "401", label: "Fournisseurs", debit: 0, credit: 2_000_000 },
  { code: "4431", label: "TVA facturée", debit: 0, credit: 500_000 },
  { code: "4452", label: "TVA récupérable", debit: 200_000, credit: 0 },
  { code: "421", label: "Personnel", debit: 0, credit: 300_000 },
  { code: "4311", label: "CNSS", debit: 0, credit: 100_000 },
  { code: "601", label: "Achats", debit: 6_000_000, credit: 0 },
  { code: "661", label: "Charges de personnel", debit: 1_000_000, credit: 0 },
  { code: "701", label: "Ventes", debit: 0, credit: 10_000_000 },
];

const seedRows = (): BalanceRow[] => {
  const db = seedDatabase();
  const companyId = db.companies[0].id;
  return trialBalance(
    db.entries.filter((e) => e.companyId === companyId),
    db.accounts,
  ).map((r) => ({ code: r.code, label: r.label, debit: r.debit, credit: r.credit }));
};

describe("balance de contrôle — moteur liasse (référence)", () => {
  it("valorise correctement chaque poste", () => {
    const st = buildStatements(CONTROLE);
    expect(st.bilan.immoBrut).toBe(5_000_000);
    expect(st.bilan.amort).toBe(1_000_000);
    expect(st.bilan.immoNet).toBe(4_000_000);
    expect(st.bilan.stocks).toBe(2_000_000);
    expect(st.bilan.creancesClients).toBe(3_000_000);
    expect(st.bilan.creancesEtat).toBe(200_000);
    expect(st.bilan.creances).toBe(3_200_000);
    expect(st.bilan.tresorerie).toBe(4_000_000);
    expect(st.bilan.capitaux).toBe(7_300_000);
    expect(st.bilan.dettesFourn).toBe(2_000_000);
    expect(st.bilan.dettesFiscalesSociales).toBe(900_000);
  });

  it("équilibre actif et passif au franc près", () => {
    const st = buildStatements(CONTROLE);
    expect(st.bilan.actifTotal).toBe(13_200_000);
    expect(st.bilan.passifTotal).toBe(13_200_000);
    expect(st.bilan.actifTotal - st.bilan.passifTotal).toBe(0);
    expect(st.bilan.resultat).toBe(3_000_000);
    expect(st.result.resultat).toBe(3_000_000);
  });

  it("ne signale aucun contrôle bloquant", () => {
    const checks = runChecks(buildStatements(CONTROLE));
    expect(checks.filter((c) => c.status === "blocking")).toHaveLength(0);
  });
});

describe("balance de contrôle — moteur factorisé (engine)", () => {
  it("produit les mêmes totaux que la référence", () => {
    const r = runEngine(CONTROLE, [], CHART_OF_ACCOUNTS as never, {});
    const b = r.bilan["N"];
    expect(b.immoBrut).toBe(5_000_000);
    expect(b.immoNet).toBe(4_000_000);
    expect(b.stocks).toBe(2_000_000);
    expect(b.creances).toBe(3_200_000);
    expect(b.tresorerie).toBe(4_000_000);
    expect(b.totalActif).toBe(13_200_000);
    expect(b.capitaux).toBe(7_300_000);
    expect(b.resultat).toBe(3_000_000);
    expect(b.dettesFourn).toBe(2_000_000);
    expect(b.dettesFiscalesSociales).toBe(900_000);
    expect(b.totalPassif).toBe(13_200_000);
    expect(b.totalActif - b.totalPassif).toBe(0);
  });

  it("les deux moteurs produisent le même bilan sur le jeu réel", () => {
    const rows = seedRows();
    const st = buildStatements(rows);
    const b = runEngine(rows, [], CHART_OF_ACCOUNTS as never, {}).bilan["N"];
    expect(b.totalActif).toBe(st.bilan.actifTotal);
    expect(b.totalPassif).toBe(st.bilan.passifTotal);
  });

  it("le dossier de démonstration ne déclenche aucun contrôle bloquant", () => {
    const st = buildStatements(seedRows());
    const blocking = runChecks(st).filter((c) => c.status === "blocking");
    expect(blocking).toEqual([]);
  });

  it("le total du passif est la somme exacte de ses composantes", () => {
    const b = runEngine(CONTROLE, [], CHART_OF_ACCOUNTS as never, {}).bilan["N"];
    const somme = b.capitaux + b.resultat + b.dettesFin + b.dettesFourn +
      b.dettesFiscalesSociales + b.autresDettes + b.tresoPassif;
    expect(somme).toBe(b.totalPassif);
  });
});

describe("garde-fou : comptes non mappés", () => {
  it("un compte hors mapping ne disparaît jamais en silence", () => {
    const rows: BalanceRow[] = [
      ...CONTROLE,
      { code: "901", label: "Engagement obtenu", debit: 0, credit: 50_000 },
      { code: "902", label: "Engagement accordé (contrepartie)", debit: 50_000, credit: 0 },
    ];
    const mapping = computePostes(rows);
    // 9 = engagements hors bilan : suivis séparément, jamais fondus dans le bilan
    expect(mapping.postes.horsBilan).toBe(0); // 901 et 902 se compensent
    expect(unmappedCodes(rows)).toEqual([]);
    // un engagement isolé est bien suivi (et non perdu)
    expect(computePostes([{ code: "901", debit: 0, credit: 50_000 }]).postes.horsBilan).toBe(50_000);
    const st = buildStatements(rows);
    expect(st.bilan.actifTotal - st.bilan.passifTotal).toBe(0);
  });

  it("signale un code inconnu et rend l'écart visible", () => {
    const rows: BalanceRow[] = [
      ...CONTROLE,
      { code: "ABCD12", label: "Compte inconnu", debit: 0, credit: 50_000 },
      { code: "521", label: "Banque (contrepartie)", debit: 50_000, credit: 0 },
    ];
    const st = buildStatements(rows);
    expect(st.nonMappes).toHaveLength(1);
    expect(st.nonMappes[0].code).toBe("ABCD12");
    const checks = runChecks(st);
    const ctl = checks.find((c) => c.id === "unmapped");
    expect(ctl?.status).toBe("blocking");
    expect(st.bilan.actifTotal - st.bilan.passifTotal).not.toBe(0);
  });
});

describe("cas particuliers", () => {
  it("exercice déficitaire : résultat négatif au passif, équilibre préservé", () => {
    const rows: BalanceRow[] = [
      { code: "101", label: "Capital", debit: 0, credit: 3_000_000 },
      { code: "521", label: "Banque", debit: 3_000_000, credit: 0 },
      { code: "601", label: "Achats", debit: 5_000_000, credit: 0 },
      { code: "701", label: "Ventes", debit: 0, credit: 3_000_000 },
      { code: "401", label: "Fournisseurs", debit: 0, credit: 2_000_000 },
    ];
    const st = buildStatements(rows);
    expect(st.bilan.resultat).toBe(-2_000_000);
    expect(st.bilan.actifTotal).toBe(3_000_000);
    expect(st.bilan.passifTotal).toBe(3_000_000);
  });

  it("TVA créditrice : la créance d'État reste à l'actif", () => {
    const rows: BalanceRow[] = [
      { code: "101", label: "Capital", debit: 0, credit: 1_000_000 },
      { code: "521", label: "Banque", debit: 650_000, credit: 0 },
      { code: "4452", label: "TVA récupérable", debit: 350_000, credit: 0 },
      { code: "601", label: "Achats", debit: 250_000, credit: 0 },
      { code: "4431", label: "TVA facturée", debit: 0, credit: 200_000 },
      { code: "701", label: "Ventes", debit: 0, credit: 50_000 },
    ];
    const st = buildStatements(rows);
    expect(st.bilan.creancesEtat).toBe(350_000);
    expect(st.bilan.dettesFiscalesSociales).toBe(200_000);
    expect(st.bilan.creances).toBe(350_000);
    expect(st.bilan.actifTotal).toBe(st.bilan.passifTotal);
  });
});

describe("référence : jeu de démonstration (102 écritures)", () => {
  it("équilibre le bilan et mappe tous les comptes", () => {
    const rows = seedRows();
    const st = buildStatements(rows);
    expect(st.totals.debit).toBe(st.totals.credit);
    // 28 140 921 (ancien calcul) − 180 000 de dépréciations de créances (49),
    // désormais déduites de l'actif au lieu d'être présentées en dettes.
    expect(st.bilan.actifTotal).toBe(27_440_921);
    expect(st.bilan.passifTotal).toBe(27_440_921);
    expect(st.bilan.actifTotal - st.bilan.passifTotal).toBe(0);
    expect(st.nonMappes).toEqual([]);
    // Classes 6 + 7 + opérations HAO (classe 8) : 20 640 000 − 21 119 805
    expect(st.result.produits).toBe(20_640_000);
    expect(st.result.charges).toBe(21_119_805);
    expect(st.result.resultat).toBe(-479_805);
  });
});
