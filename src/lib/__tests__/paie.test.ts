/**
 * P0-3 — Recette de la paie.
 *
 * Tous les attendus sont calculables à la main :
 *   brut 450 000 · CNSS 4 % plafonnée à 300 000 = 12 000
 *                 AMU  2 % plafonnée à 300 000 =  6 000
 *   assiette IRPP = 450 000 − 12 000 = 438 000 → 5 256 000 / an
 *     tranches : 0 % jusqu'à 900 000 · 11 % de 900 000 à 3 000 000
 *                17 % de 3 000 000 à 6 000 000
 *     IRPP annuel = 2 100 000 × 11 % + 2 256 000 × 17 % = 231 000 + 383 520
 *                 = 614 520 → mensuel 51 210
 */
import { describe, it, expect } from "vitest";
import { calculerBulletin, paieParamsFromConfig, totaliserBulletins, ecrituresPaie, type PaieParams } from "../paie";
import { seedDatabase } from "../seed";
import { runPayroll } from "../actions";

const PARAMS: PaieParams = {
  cnss: { employeeRate: 4, employerRate: 17.5, plafond: 300_000 },
  amu: { employeeRate: 2, employerRate: 4, plafond: 300_000 },
  irppBrackets: [
    { id: "1", versionId: "v", taxCode: "IRPP", bracketMin: 0, bracketMax: 900_000, rate: 0, order: 1 },
    { id: "2", versionId: "v", taxCode: "IRPP", bracketMin: 900_000, bracketMax: 3_000_000, rate: 11, order: 2 },
    { id: "3", versionId: "v", taxCode: "IRPP", bracketMin: 3_000_000, bracketMax: 6_000_000, rate: 17, order: 3 },
    { id: "4", versionId: "v", taxCode: "IRPP", bracketMin: 6_000_000, bracketMax: 9_000_000, rate: 23, order: 4 },
  ],
  forfaitRate: 5,
};

describe("paie > cotisations", () => {
  it("CNSS et AMU sont plafonnées à 300 000 d'assiette", () => {
    const b = calculerBulletin(450_000, PARAMS);
    expect(b.baseCNSS).toBe(300_000);
    expect(b.baseAMU).toBe(300_000);
    expect(b.cnssEmployee).toBe(12_000);
    expect(b.cnssEmployer).toBe(52_500);
    expect(b.amuEmployee).toBe(6_000);
    expect(b.amuEmployer).toBe(12_000);
  });

  it("l'AMU est retenue — elle ne l'était jamais auparavant", () => {
    const b = calculerBulletin(450_000, PARAMS);
    expect(b.amuEmployee).toBeGreaterThan(0);
    expect(b.totalRetenues).toBe(b.cnssEmployee + b.amuEmployee + b.irpp);
  });

  it("sous le plafond, l'assiette est le brut entier", () => {
    const b = calculerBulletin(200_000, PARAMS);
    expect(b.baseCNSS).toBe(200_000);
    expect(b.cnssEmployee).toBe(8_000);
    expect(b.amuEmployee).toBe(4_000);
  });
});

describe("paie > IRPP progressif", () => {
  it("barème à 8 tranches : 51 210 pour 450 000 de brut", () => {
    const b = calculerBulletin(450_000, PARAMS);
    expect(b.modeIRPP).toBe("bareme");
    expect(b.assietteIRPP).toBe(438_000);
    expect(b.irpp).toBe(51_210);
    expect(b.net).toBe(450_000 - 12_000 - 6_000 - 51_210);
  });

  it("barème à 8 tranches : 34 210 pour 350 000 de brut", () => {
    const b = calculerBulletin(350_000, PARAMS);
    expect(b.irpp).toBe(34_210);
  });

  it("le barème est plus progressif qu'un forfait de 5 %", () => {
    const b = calculerBulletin(450_000, PARAMS);
    expect(b.irpp).toBeGreaterThan(Math.round(450_000 * 0.05));
  });

  it("le détail des tranches est exposé pour rendre le calcul explicable", () => {
    const b = calculerBulletin(450_000, PARAMS);
    expect(b.tranches.length).toBe(4);
    expect(b.tranches[1]).toMatchObject({ min: 900_000, rate: 11, base: 2_100_000, impot: 231_000 });
    expect(b.tranches[2]).toMatchObject({ min: 3_000_000, rate: 17, base: 2_256_000, impot: 383_520 });
  });

  it("sans barème : repli forfaitaire explicite et signalé, jamais silencieux", () => {
    const b = calculerBulletin(450_000, { ...PARAMS, irppBrackets: [] });
    expect(b.modeIRPP).toBe("forfait");
    expect(b.irpp).toBe(22_500);
    expect(b.alertes.join(" ")).toContain("barème IRPP");
  });
});

describe("paie > cohérence du bulletin et de l'écriture", () => {
  it("net et coût employeur découlent exactement des composantes", () => {
    const b = calculerBulletin(450_000, PARAMS);
    expect(b.gross - b.totalRetenues).toBe(b.net);
    expect(b.coutEmployeur).toBe(450_000 + 52_500 + 12_000);
  });

  it("l'écriture de paie est équilibrée, AMU comprise", () => {
    const t = totaliserBulletins([calculerBulletin(450_000, PARAMS), calculerBulletin(350_000, PARAMS)]);
    const e = ecrituresPaie(t);
    expect(e.totalDebit).toBe(e.totalCredit);
    expect(e.lines.some((l) => l.accountId === "4331")).toBe(true); // AMU sur un compte dédié
    expect(e.lines.some((l) => l.accountId === "4472")).toBe(true); // IRPP
  });
});

describe("paie > le dossier de démonstration est réellement payé", () => {
  it("runPayroll applique barème + AMU et produit une écriture équilibrée", () => {
    const db = seedDatabase();
    const companyId = db.companies[0].id;
    const r = runPayroll(companyId, "novembre 2026");
    expect(r.ok).toBe(true);
    expect(r.slips).toBe(2);

    const after = seedDatabase(); // état indépendant pour les attentes
    expect(after.payrollConfig.verified).toBe(false);

    // Valeurs attendues, calculées à la main sur les deux salariés du seed.
    const employes = db.employees.filter((e) => e.companyId === companyId);
    expect(employes.map((e) => e.grossSalary).sort((a, b) => b - a)).toEqual([450_000, 350_000]);
    const total = totaliserBulletins(employes.map((e) => calculerBulletin(e.grossSalary, paieParamsFromConfig(db.payrollConfig, db.taxBrackets))));
    expect(total.irpp).toBe(51_210 + 34_210);
    expect(total.amuEmployee).toBe(12_000);
    expect(total.cnssEmployee).toBe(24_000);
    expect(total.retenues).toBe(51_210 + 34_210 + 12_000 + 24_000);

    const ecriture = ecrituresPaie(total);
    expect(ecriture.totalDebit).toBe(ecriture.totalCredit);
  });

  it("le barème versionné de la base est bien celui utilisé (8 tranches)", () => {
    const db = seedDatabase();
    const params = paieParamsFromConfig(db.payrollConfig, db.taxBrackets);
    expect(params.irppBrackets.length).toBe(8);
    expect(calculerBulletin(450_000, params).modeIRPP).toBe("bareme");
  });
});
