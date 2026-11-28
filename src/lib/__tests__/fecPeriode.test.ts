/**
 * P13 — Le FEC se dépose par exercice.
 * L'export couvrait tout l'historique validé : un fichier contenant N et N-1 ne
 * se rattache à aucune liasse et se fait rejeter au contrôle.
 */
import { describe, it, expect } from "vitest";
import { buildFec, entriesInScope, fecScopeFromFiscalYear, fecFileName, type FecScope } from "../fec";
import { seedDatabase } from "../seed";

const db = seedDatabase();
const entries = db.entries;
const companyId = db.companies[0].id;
const journals = db.journals;
const accounts = db.accounts;

const scope2026: FecScope = { label: "2026", startDate: "2026-01-01", endDate: "2026-12-31" };

describe("FEC — périmètre d'exercice", () => {
  it("reprend exactement les écritures du seed sur l'exercice 2026", () => {
    const fec = buildFec(entries, journals, accounts, db.tiers, scope2026);
    expect(fec.scope).toEqual(scope2026);
    expect(fec.entryCount).toBe(102);
    expect(fec.lineCount).toBe(281);
    expect(fec.totals).toEqual({ debit: 80_951_571, credit: 80_951_571, ecart: 0 });
    expect(fec.excludedCount).toBe(0);
  });

  it("écarte les écritures d'un autre exercice sans les compter dans le fichier", () => {
    const fec = buildFec(entries, journals, accounts, db.tiers, { label: "2025", startDate: "2025-01-01", endDate: "2025-12-31" });
    expect(fec.entryCount).toBe(0);
    expect(fec.lineCount).toBe(0);
    expect(fec.excludedCount).toBe(102);
  });

  it("inclut les deux bornes, et elles seules", () => {
    const bounds = entriesInScope(
      [{ date: "2025-12-31" }, { date: "2026-01-01" }, { date: "2026-12-31" }, { date: "2027-01-01" }],
      scope2026,
    );
    expect(bounds.map((e) => e.date)).toEqual(["2026-01-01", "2026-12-31"]);
  });

  it("lit le périmètre depuis l'exercice comptable, avec un libellé de repli", () => {
    const fy = db.fiscalYears.find((y) => y.companyId === companyId)!;
    const scope = fecScopeFromFiscalYear(fy);
    expect(scope.startDate).toBe(fy.startDate.slice(0, 10));
    expect(scope.endDate).toBe(fy.endDate.slice(0, 10));
    expect(scope.label.length).toBeGreaterThan(0);
    expect(fecScopeFromFiscalYear({ startDate: "2026-01-01", endDate: "2026-12-31" }).label).toBe("2026");
  });

  it("nomme le fichier avec l'exercice, sans espace ni caractère interdit", () => {
    const name = fecFileName("Sarl Acme & Fils", new Date("2026-11-28T00:00:00Z"), "Exercice 2026");
    expect(name).toBe("FEC_20261128_Sarl_Acme_Fils_Exercice_2026.txt"); // ni espace ni « & » dans un nom de dépôt
    expect(fecFileName("Acme", new Date("2026-11-28T00:00:00Z"))).toBe("FEC_20261128_Acme.txt");
  });

  it("sans périmètre, l'export reste celui de tout l'historique (compatibilité)", () => {
    const fec = buildFec(entries, journals, accounts, db.tiers);
    expect(fec.scope).toBeNull();
    expect(fec.entryCount).toBe(102);
    expect(fec.excludedCount).toBe(0);
  });
});
