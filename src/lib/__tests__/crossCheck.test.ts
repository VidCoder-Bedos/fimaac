/**
 * P2 — Recette des contrôles croisés.
 *
 * Ce moteur existait depuis l'origine mais n'était branché nulle part : les
 * écarts justes qu'il produisait n'atteignaient jamais l'écran. Les tests
 * ci-dessous verrouillent son comportement sur des données réelles (seed) et
 * sur un dossier volontairement faussé.
 */
import { describe, it, expect } from "vitest";
import { runCrossChecks } from "../crossCheck";
import { seedDatabase } from "../seed";
import type { JournalEntry } from "../types";

const seedContext = () => {
  const db = seedDatabase();
  const companyId = db.companies[0].id;
  return {
    db,
    data: {
      entries: db.entries.filter((e) => e.companyId === companyId),
      employees: db.employees.filter((e) => e.companyId === companyId),
      bankTransactions: db.bankTransactions.filter((t) => t.companyId === companyId),
      fixedAssets: db.fixedAssets.filter((f) => f.companyId === companyId),
    },
  };
};

describe("contrôles croisés > dossier de démonstration", () => {
  it("produit un rapport complet, avec toutes les sources attendues", () => {
    const { data } = seedContext();
    const report = runCrossChecks(data);
    expect(report.checks.length).toBeGreaterThanOrEqual(5);
    const modules = report.checks.map((c) => c.moduleName);
    expect(modules).toContain("Balance");
    expect(modules).toContain("Paie ↔ Comptabilité");
    expect(modules).toContain("CNSS ↔ Paie");
  });

  it("la balance est équilibrée : Σ débit = Σ crédit, écart nul", () => {
    const { data } = seedContext();
    const balance = runCrossChecks(data).checks.find((c) => c.moduleName === "Balance")!;
    expect(balance.ecart).toBe(0);
    expect(balance.level).toBe("ok");
    expect(balance.valueA).toBe(balance.valueB);
  });

  it("les compteurs du rapport sont cohérents avec la liste des contrôles", () => {
    const { data } = seedContext();
    const r = runCrossChecks(data);
    // Un constat informatif reste un contrôle : il doit être compté, sinon le
    // résumé affiché sous-estime le nombre de lignes examinées.
    expect(r.okCount + r.warningCount + r.criticalCount + r.infoCount).toBe(r.checks.length);
    expect(["ok", "info", "warning", "critical"]).toContain(r.overallStatus);
  });

  it("les écarts signalés sont chiffrés, jamais de simples libellés", () => {
    const { data } = seedContext();
    for (const c of runCrossChecks(data).checks) {
      expect(Number.isFinite(c.valueA)).toBe(true);
      expect(Number.isFinite(c.valueB)).toBe(true);
      expect(Number.isFinite(c.ecart)).toBe(true);
      expect(typeof c.detail).toBe("string");
      expect(c.detail.length).toBeGreaterThan(0);
    }
  });
});

describe("contrôles croisés > détection d'une anomalie réelle", () => {
  it("une écriture déséquilibrée est signalée comme critique", () => {
    const { data } = seedContext();
    const broken: JournalEntry = {
      ...data.entries[0],
      id: "entry-desequilibree",
      lines: [
        { id: "l1", accountId: "601", label: "Achat", debit: 1_000_000, credit: 0, taxCode: null, thirdPartyId: null, analytic: null },
        { id: "l2", accountId: "401", label: "Fournisseur", debit: 0, credit: 900_000, taxCode: null, thirdPartyId: null, analytic: null },
      ],
    };
    const report = runCrossChecks({ ...data, entries: [...data.entries, broken] });
    const balance = report.checks.find((c) => c.moduleName === "Balance")!;
    expect(balance.ecart).toBe(100_000);
    expect(balance.level).toBe("critical");
    expect(report.overallStatus).toBe("critical");
  });

  it("une transaction bancaire non rapprochée est remontée", () => {
    const { data } = seedContext();
    const withUnreconciled = runCrossChecks({
      ...data,
      bankTransactions: [...data.bankTransactions, { reconciled: false, amount: 250_000 } as never],
    });
    const banque = withUnreconciled.checks.find((c) => c.moduleName === "Banque");
    expect(banque).toBeDefined();
    expect(banque!.detail.length).toBeGreaterThan(0);
  });
});
