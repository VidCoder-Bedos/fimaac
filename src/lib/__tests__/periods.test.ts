import { describe, it, expect } from "vitest";
import { resolveAccountingDate, fiscalYearFor, describeFiscalYears, auditFiscalYearPlacement, isValidIsoDate } from "../periods";
import type { AccountingPeriod, FiscalYear } from "../types";

const fy = (id: string, start: string, end: string, status: FiscalYear["status"] = "open"): FiscalYear =>
  ({ id, companyId: "c1", label: `Exercice ${start.slice(0, 4)}`, startDate: start, endDate: end, status });

const period = (id: string, y: number, m: number, status: AccountingPeriod["status"] = "open"): AccountingPeriod => ({
  id,
  fiscalYearId: "fy2026",
  companyId: "c1",
  label: `${m}/${y}`,
  month: m,
  year: y,
  startDate: `${y}-${String(m).padStart(2, "0")}-01`,
  endDate: `${y}-${String(m).padStart(2, "0")}-28`,
  status,
});

const years = [fy("fy2026", "2026-01-01", "2026-12-31"), fy("fy2027", "2027-01-01", "2027-12-31")];
const periods = [period("p1", 2026, 1), period("p2", 2026, 3), period("p3", 2027, 2)];

describe("Périodes — validité et sélection", () => {
  it("reconnaît une date ISO valide et refuse le reste", () => {
    expect(isValidIsoDate("2026-03-05")).toBe(true);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("05/03/2026")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
  });

  it("choisit l'exercice qui contient la date, pas le premier du dossier", () => {
    expect(fiscalYearFor("2027-02-10", years)?.id).toBe("fy2027");
    expect(fiscalYearFor("2025-12-31", years)).toBeNull();
  });

  it("décrit les exercices pour un message exploitable", () => {
    expect(describeFiscalYears(years)).toContain("2026-01-01 → 2026-12-31");
    expect(describeFiscalYears([])).toContain("aucun exercice");
  });
});

describe("Périodes — résolution d'une date comptable", () => {
  it("accepte une date dans une période ouverte", () => {
    const r = resolveAccountingDate("2026-03-10", years, periods, { companyId: "c1" });
    expect(r.ok).toBe(true);
    expect(r.fiscalYear?.id).toBe("fy2026");
    expect(r.period?.id).toBe("p2");
    expect(r.periodCreated).toBe(false);
  });

  it("refuse une date hors exercice en nommant la date et les bornes", () => {
    const r = resolveAccountingDate("2025-05-12", years, periods, { companyId: "c1" });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("outside-fiscal-year");
    expect(r.message).toContain("2025-05-12");
    expect(r.message).toContain("2026-01-01");
  });

  it("refuse un exercice clos", () => {
    const closed = [fy("fy2025", "2025-01-01", "2025-12-31", "closed")];
    const r = resolveAccountingDate("2025-06-01", closed, [], { companyId: "c1" });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("closed-fiscal-year");
    expect(r.message).toContain("clos");
  });

  it("refuse une période clôturée en nommant le mois", () => {
    const withClosed = [period("p1", 2026, 1, "closed")];
    const r = resolveAccountingDate("2026-01-20", years, withClosed, { companyId: "c1" });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("closed-period");
    expect(r.message).toContain("janvier 2026");
  });

  it("signale une période absente à créer plutôt que d'en détourner une autre", () => {
    const r = resolveAccountingDate("2026-07-04", years, periods, { companyId: "c1" });
    expect(r.ok).toBe(true);
    expect(r.period).toBeNull();
    expect(r.periodCreated).toBe(true);
    expect(r.fiscalYear?.id).toBe("fy2026");
    expect(r.message).toContain("juillet 2026");
  });

  it("refuse une date mal formée sans lever d'exception", () => {
    const r = resolveAccountingDate("2026-13-45", years, periods, { companyId: "c1" });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("invalid-date");
  });

  it("ne confond jamais deux dossiers", () => {
    const other = [fy("fyX", "2026-01-01", "2026-12-31")].map((f) => ({ ...f, companyId: "c2" }));
    const r = resolveAccountingDate("2026-05-05", other, [], { companyId: "c1" });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("outside-fiscal-year");
  });
});

describe("Périodes — contrôle de l'héritage", () => {
  it("détecte une écriture rattachée au mauvais exercice", () => {
    const audit = auditFiscalYearPlacement(
      [{ id: "e1", number: "OD-0001", date: "2025-05-12", fiscalYearId: "fy2026", periodId: "p1" }],
      years, periods,
    );
    expect(audit.ok).toBe(false);
    expect(audit.wrongFiscalYear).toBe(1);
    expect(audit.anomalies[0].reason).toContain("Exercice 2026");
  });

  it("détecte une écriture sur la mauvaise période et l'écriture non rattachée", () => {
    const audit = auditFiscalYearPlacement(
      [
        { id: "e1", number: "OD-0001", date: "2026-03-10", fiscalYearId: "fy2026", periodId: "p1" },
        { id: "e2", number: "OD-0002", date: "2026-03-11", fiscalYearId: "inconnu", periodId: "p2" },
      ],
      years, periods,
    );
    expect(audit.wrongPeriod).toBe(1);
    expect(audit.unassigned).toBe(1);
    expect(audit.anomalies.map((a) => a.entryId)).toEqual(["e1", "e2"]);
  });

  it("accepte une écriture correctement rattachée (mois identique, fin au 28)", () => {
    const audit = auditFiscalYearPlacement(
      [{ id: "e1", number: "OD-0001", date: "2026-03-31", fiscalYearId: "fy2026", periodId: "p2" }],
      years, periods,
    );
    expect(audit.ok).toBe(true);
    expect(audit.checked).toBe(1);
  });
});
