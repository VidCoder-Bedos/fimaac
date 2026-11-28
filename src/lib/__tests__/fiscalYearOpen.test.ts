/**
 * P28 — Ouvrir un exercice : une seule implémentation, et une porte de sortie
 * au 1er janvier.
 *
 * Avant : `addCompanyWithAccess` recopiait la création de l'exercice et de ses
 * douze périodes (en terminant chaque période au **28** du mois), tandis que
 * `ensureFiscalYear` — la fonction prévue pour cela — n'était appelée par
 * personne. Résultat : un dossier créé en 2025 ne pouvait plus rien saisir en
 * 2026, et aucun écran n'offrait d'ouvrir l'exercice suivant.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ensureFiscalYear, addCompanyWithAccess } from "../actions";
import { getDB, resetDB, mutate } from "../store";
import { resolveAccountingDate } from "../periods";

const sleep = (ms = 150) => new Promise((r) => setTimeout(r, ms));

describe("Ouverture d'exercice", () => {
  beforeEach(() => resetDB());

  it("crée l'exercice et douze périodes, avec la vraie fin de mois", async () => {
    const companyId = getDB().companies[0].id;
    const res = ensureFiscalYear(companyId, 2031);
    expect(res).toMatchObject({ ok: true, created: true });
    await sleep();

    const db = getDB();
    const year = db.fiscalYears.find((f) => f.companyId === companyId && f.label === "Exercice 2031")!;
    expect(year).toBeTruthy();
    expect(year.startDate).toBe("2031-01-01");
    expect(year.endDate).toBe("2031-12-31");

    const periods = db.periods.filter((p) => p.fiscalYearId === year.id);
    expect(periods).toHaveLength(12);
    expect(periods[0]).toMatchObject({ month: 1, year: 2031, startDate: "2031-01-01", endDate: "2031-01-31" });
    expect(periods[1].endDate).toBe("2031-02-28");
    expect(periods[11]).toMatchObject({ month: 12, endDate: "2031-12-31" });
  });

  it("est idempotent : un second appel ne duplique rien et n'écrit pas d'audit", async () => {
    const companyId = getDB().companies[0].id;
    ensureFiscalYear(companyId, 2032);
    await sleep();
    const before = getDB();
    const auditCount = before.auditLogs.length;

    const second = ensureFiscalYear(companyId, 2032);
    expect(second).toMatchObject({ ok: true, created: false });
    await sleep();
    const after = getDB();
    expect(after.fiscalYears.filter((f) => f.label === "Exercice 2032")).toHaveLength(1);
    expect(after.periods.filter((p) => p.year === 2032)).toHaveLength(12);
    expect(after.auditLogs.length).toBe(auditCount);
  });

  it("l'ouverture est tracée dans le journal d'audit", async () => {
    const companyId = getDB().companies[0].id;
    ensureFiscalYear(companyId, 2033);
    await sleep();
    const log = getDB().auditLogs[0];
    expect(log.action).toBe("FISCAL_YEAR_OPEN");
    expect(log.after).toContain("2033");
    expect(log.after).toContain("12 périodes");
  });

  it("refuse un exercice hors bornes et un mois de début impossible", () => {
    const companyId = getDB().companies[0].id;
    expect(ensureFiscalYear(companyId, 1800).ok).toBe(false);
    expect(ensureFiscalYear(companyId, 2200).ok).toBe(false);
    expect(ensureFiscalYear(companyId, 2030, 0).ok).toBe(false);
    expect(ensureFiscalYear("", 2030).ok).toBe(false);
  });

  it("après ouverture, une écriture du 15 janvier N+1 trouve sa période", async () => {
    const companyId = getDB().companies[0].id;
    ensureFiscalYear(companyId, 2034);
    await sleep();
    const db = getDB();
    const res = resolveAccountingDate("2034-01-15", db.fiscalYears, db.periods, { companyId });
    expect(res.ok).toBe(true);
    expect(res.period?.label).toContain("2034");
  });

  it("un dossier créé obtient ses douze périodes par le même code", async () => {
    // La création de dossier exige une session cabinet.
    const seedAdmin = getDB().users.find((u) => u.role !== "client_admin")!;
    mutate((s) => { s.session.userId = seedAdmin.id; });
    await sleep();
    const res = addCompanyWithAccess({
      name: "Beta SARL", tradeName: "Beta", legalForm: "SARL", nif: "1009999999",
      sector: "Services", activity: "Conseil", city: "Lomé", capital: 1_000_000,
      taxRegime: "ri", vatPayer: true, riskLevel: "low", email: "beta@example.tg",
      phone: "+228 90 00 00 00", exercise: "2035",
    });
    expect(res.ok).toBe(true);
    await sleep();
    const after = getDB();
    const company = after.companies.find((c) => c.name === "Beta SARL")!;
    const year = after.fiscalYears.find((f) => f.companyId === company.id)!;
    expect(year.startDate).toBe("2035-01-01");
    const periods = after.periods.filter((p) => p.fiscalYearId === year.id);
    expect(periods).toHaveLength(12);
    // La copie se terminait au 28 : on vérifie la vraie fin de mois.
    expect(periods.find((p) => p.month === 1)!.endDate).toBe("2035-01-31");
    expect(periods.find((p) => p.month === 2)!.endDate).toBe("2035-02-28");
  });

  it("une écriture hors du dernier exercice reste refusée, avec le motif", async () => {
    const companyId = getDB().companies[0].id;
    ensureFiscalYear(companyId, 2036);
    await sleep();
    const db = getDB();
    const res = resolveAccountingDate("2040-05-02", db.fiscalYears, db.periods, { companyId });
    expect(res.ok).toBe(false);
    expect(res.message).toContain("2040");
  });
});
