/**
 * P0-2 — Recette de la source de vérité fiscale unique.
 *
 * Chaque cas est calculable à la main. Le dernier bloc vérifie la seule chose
 * qui compte vraiment : que la page Fiscalité, le moteur factorisé et la
 * grille TVA donnent le MÊME chiffre sur le jeu de démonstration réel.
 */
import { describe, it, expect } from "vitest";
import {
  computeIsFiscal,
  computeTvaFiscal,
  fiscalBaseFromMoves,
  roundDown,
  IS_PARAMS_DEFAUT,
  type FiscalBase,
} from "../fiscalite";
import { computeTax } from "../tax";
import { tvaGrid } from "../actions";
import { runEngine } from "../engine";
import { CHART_OF_ACCOUNTS } from "../chart";
import { seedDatabase } from "../seed";
import { trialBalance } from "../accounting";

const vide = (over: Partial<FiscalBase> = {}): FiscalBase => ({
  chiffreAffaires: 0,
  produits: 0,
  charges: 0,
  resultatComptable: 0,
  tvaCollectee: 0,
  tvaDeductible: 0,
  tvaDeductibleImmo: 0,
  ...over,
});

const seed = () => {
  const db = seedDatabase();
  const companyId = db.companies[0].id;
  const entries = db.entries.filter((e) => e.companyId === companyId);
  const companyEntries = db.entries.filter((e) => e.companyId === companyId && e.status === "validated");
  return { db, companyId, entries, valid: companyEntries };
};

describe("fiscalité > TVA", () => {
  it("TVA à payer : collectée − déductible, base = chiffre d'affaires HT", () => {
    const t = computeTvaFiscal(
      vide({ chiffreAffaires: 10_000_000, tvaCollectee: 1_800_000, tvaDeductible: 1_000_000 }),
      { rate: 18 },
    );
    expect(t.baseHT).toBe(10_000_000); // la base est le CA, jamais la TVA collectée
    expect(t.aPayer).toBe(800_000);
    expect(t.creditReporte).toBe(0);
  });

  it("TVA créditrice : jamais un montant négatif à payer, mais un crédit à reporter", () => {
    const t = computeTvaFiscal(vide({ tvaCollectee: 500_000, tvaDeductible: 800_000 }), { rate: 18 });
    expect(t.aPayer).toBe(0);
    expect(t.creditReporte).toBe(300_000);
    expect(t.net).toBe(-300_000);
  });

  it("le crédit de la période précédente s'impute avant de conclure au paiement", () => {
    const t = computeTvaFiscal(vide({ tvaCollectee: 1_000_000, tvaDeductible: 600_000 }), {
      rate: 18,
      creditAnterieur: 500_000,
    });
    expect(t.aPayer).toBe(0);
    expect(t.creditReporte).toBe(100_000);
  });

  it("une base HT se reconstitue depuis la TVA collectée si les comptes 70 font défaut", () => {
    const t = computeTvaFiscal(vide({ chiffreAffaires: 0, tvaCollectee: 1_800_000 }), { rate: 18 });
    expect(t.baseHT).toBe(10_000_000);
    expect(t.baseHTDeduite).toBe(10_000_000);
  });

  it("ventile la TVA sur immobilisations sans la compter deux fois", () => {
    const base = fiscalBaseFromMoves(
      new Map([
        ["4451", { debit: 576_000, credit: 0 }],
        ["4452", { debit: 584_868, credit: 0 }],
        ["4431", { debit: 0, credit: 3_634_200 }],
      ]),
    );
    expect(base.tvaDeductible).toBe(1_160_868);
    expect(base.tvaDeductibleImmo).toBe(576_000);
  });
});

describe("fiscalité > IS et minimum de perception", () => {
  it("bénéfice : l'IS au taux l'emporte sur le minimum de perception", () => {
    const is = computeIsFiscal(5_000_000, vide({ chiffreAffaires: 50_000_000, resultatComptable: 5_000_000 }));
    expect(is.impotCalcule).toBe(1_350_000);
    expect(is.minimumPerception).toBe(500_000);
    expect(is.impotDu).toBe(1_350_000);
  });

  it("perte : l'IS est nul mais le minimum de perception reste dû", () => {
    const is = computeIsFiscal(-479_805, vide({ chiffreAffaires: 20_190_000, resultatComptable: -479_805 }));
    expect(is.resultatFiscalArrondi).toBe(-479_000);
    expect(is.impotCalcule).toBe(0);
    expect(is.minimumPerception).toBe(201_900);
    expect(is.impotDu).toBe(201_900); // et non 0 comme l'affichait la page Fiscalité
  });

  it("petit chiffre d'affaires : minimum forfaitaire", () => {
    const is = computeIsFiscal(0, vide({ chiffreAffaires: 1_500_000 }));
    expect(is.minimumPerception).toBe(20_000);
    expect(is.impotDu).toBe(20_000);
  });

  it("les paramètres sont explicites et non enfouis dans le calcul", () => {
    const is = computeIsFiscal(10_000_000, vide({ chiffreAffaires: 100_000_000 }), {
      ...IS_PARAMS_DEFAUT,
      taux: 30,
    });
    expect(is.impotCalcule).toBe(3_000_000);
  });

  it("arrondis de tableur : troncature vers zéro", () => {
    expect(roundDown(1_357_999, -1)).toBe(1_357_990);
    expect(roundDown(-479_805, -3)).toBe(-479_000); // troncature vers zéro
  });
});

describe("fiscalité > une seule vérité sur le dossier de démonstration", () => {
  it("la page Fiscalité et le moteur factorisé donnent le même IS", () => {
    const { db, entries } = seed();
    const page = computeTax("IS", entries, db.taxRules)!;
    const rows = trialBalance(entries, CHART_OF_ACCOUNTS as never);
    const moteur = runEngine(rows, [], CHART_OF_ACCOUNTS as never, {}).fiscalite;

    expect(page.montant).toBe(moteur.is.impotDu);
    expect(page.montant).toBe(201_900);
    expect(moteur.is.minimumPerception).toBe(201_900);
  });

  it("la page Fiscalité, la grille TVA et le moteur donnent la même TVA", () => {
    const { db, companyId, entries } = seed();
    const page = computeTax("TVA", entries, db.taxRules)!;
    const grille = tvaGrid(companyId, entries);
    const rows = trialBalance(entries, CHART_OF_ACCOUNTS as never);
    const moteur = runEngine(rows, [], CHART_OF_ACCOUNTS as never, {}).fiscalite;

    expect(grille.tvaCollectee).toBe(page.tva!.collectee);
    expect(grille.tvaRecuperable).toBe(page.tva!.deductible);
    expect(grille.baseHT).toBe(page.base);
    expect(moteur.tva!.collectee).toBe(page.tva!.collectee);
    expect(moteur.tva!.deductible).toBe(page.tva!.deductible);
    expect(moteur.tva!.aPayer).toBe(page.montant);
  });

  it("la base TVA affichée est le chiffre d'affaires, pas la TVA collectée", () => {
    const { db, entries } = seed();
    const page = computeTax("TVA", entries, db.taxRules)!;
    expect(page.base).toBe(20_190_000);
    expect(page.base).not.toBe(page.tva!.collectee);
    expect(page.tva!.collectee).toBe(3_634_200);
    expect(page.tva!.deductible).toBe(1_160_868);
    expect(page.montant).toBe(2_473_332);
  });
});
