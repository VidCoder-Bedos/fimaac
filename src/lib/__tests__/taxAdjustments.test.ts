import { describe, it, expect } from "vitest";
import { applyFiscalAdjustments, totalAdjustments, computeIsFiscal, EMPTY_ADJUSTMENTS, IS_PARAMS_DEFAUT } from "../fiscalite";
import { computeIS } from "../tax";
import { seedDatabase } from "../seed";
import type { FiscalBase } from "../fiscalite";
import type { JournalEntry, TaxRuleRef } from "../types";

const base = (o: Partial<FiscalBase> = {}): FiscalBase => ({
  produits: 0, charges: 0, resultatComptable: 0, chiffreAffaires: 0,
  tvaCollectee: 0, tvaDeductible: 0, tvaDeductibleImmo: 0,
  ...o,
});

describe("Retraitements fiscaux — arithmétique", () => {
  it("réintègre et déduit dans le bon sens", () => {
    const r = applyFiscalAdjustments(1_000_000, { reintegrations: 250_000, deductions: 100_000 });
    expect(r.resultatFiscal).toBe(1_150_000);
    expect(r.resultatComptable).toBe(1_000_000);
  });

  it("ramène les montants négatifs à zéro au lieu d'inverser le retraitement", () => {
    const r = applyFiscalAdjustments(500_000, { reintegrations: -300_000, deductions: 0 });
    expect(r.reintegrations).toBe(0);
    expect(r.resultatFiscal).toBe(500_000);
  });

  it("arrondit au franc et ignore l'absence de réglages", () => {
    expect(applyFiscalAdjustments(1000.6, EMPTY_ADJUSTMENTS).resultatFiscal).toBe(1001);
    expect(applyFiscalAdjustments(1000).resultatFiscal).toBe(1000);
  });

  it("somme par type et par exercice", () => {
    const list = [
      { type: "reintegration" as const, amount: 100_000, exercise: "2026" },
      { type: "reintegration" as const, amount: 50_000, exercise: "2026" },
      { type: "reintegration" as const, amount: 999_000, exercise: "2025" },
      { type: "deduction" as const, amount: 30_000, exercise: "2026" },
    ];
    expect(totalAdjustments(list, "reintegration", "2026")).toBe(150_000);
    expect(totalAdjustments(list, "deduction", "2026")).toBe(30_000);
    expect(totalAdjustments(list, "reintegration")).toBe(1_149_000);
  });
});

describe("Retraitements fiscaux — effet sur l'IS", () => {
  it("calcule l'IS sur le résultat retraité, pas sur le résultat comptable", () => {
    const b = base({ resultatComptable: 5_000_000, chiffreAffaires: 100_000_000 });
    const sans = computeIsFiscal(5_000_000, b);
    const avec = computeIsFiscal(5_000_000, b, IS_PARAMS_DEFAUT, { reintegrations: 2_000_000, deductions: 0 });
    expect(sans.resultatFiscalArrondi).toBe(5_000_000);
    expect(avec.resultatFiscalArrondi).toBe(7_000_000);
    expect(avec.impotDu).toBeGreaterThan(sans.impotDu);
    expect(avec.reintegrations).toBe(2_000_000);
  });

  it("peut sortir un dossier déficitaire de la perte par réintégration", () => {
    // Seed : résultat comptable −479 805, CA 20 190 000 → minimum de perception 201 900.
    const b = base({ resultatComptable: -479_805, chiffreAffaires: 20_190_000 });
    const sans = computeIsFiscal(-479_805, b);
    expect(sans.impotCalcule).toBe(0);
    expect(sans.impotDu).toBe(201_900);
    const avec = computeIsFiscal(-479_805, b, IS_PARAMS_DEFAUT, { reintegrations: 1_000_000, deductions: 0 });
    expect(avec.resultatFiscalAvantArrondi).toBe(520_195);
    expect(avec.resultatFiscalArrondi).toBe(520_000);
    expect(avec.impotCalcule).toBe(140_400);
    // Le minimum de perception reste dû : il est supérieur.
    expect(avec.impotDu).toBe(201_900);
  });

  it("laisse le minimum de perception inchangé par les retraitements", () => {
    const b = base({ chiffreAffaires: 50_000_000, resultatComptable: 0 });
    const avec = computeIsFiscal(0, b, IS_PARAMS_DEFAUT, { reintegrations: 0, deductions: 3_000_000 });
    expect(avec.minimumPerception).toBe(500_000);
    expect(avec.impotDu).toBe(500_000);
  });

  it("transmet les retraitements depuis computeIS jusqu'au détail affiché", () => {
    const rule = { code: "IS", rate: 27, verified: true, source: "test", version: "1" } as unknown as TaxRuleRef;
    const entries: JournalEntry[] = [];
    const res = computeIS(entries, rule, { reintegrations: 100_000, deductions: 0 });
    const labels = res.breakdown.map((b) => b.label);
    expect(labels).toContain("Réintégrations fiscales");
    expect(labels).toContain("Déductions fiscales");
    expect(labels).toContain("Résultat fiscal avant arrondi");
  });
});

describe("Retraitements fiscaux — persistance", () => {
  it("le seed expose une collection de retraitements vide (aucune valeur inventée)", () => {
    const db = seedDatabase();
    expect(Array.isArray(db.taxAdjustments)).toBe(true);
    expect(db.taxAdjustments).toHaveLength(0);
  });
});
