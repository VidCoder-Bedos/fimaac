import { describe, it, expect } from "vitest";
import {
  easterSunday,
  togoHolidays,
  isNonWorkingDay,
  nextBusinessDay,
  computeMonthlyDueDate,
  computeQuarterlyDueDate,
  computeAnnualDueDate,
  generateObligationInstances,
  summarizeObligations,
  companyProfileFrom,
  determineApplicableObligations,
} from "../obligations";
import type { CompanyProfile } from "../regulatory-extensions";

const profile = (o: Partial<CompanyProfile> = {}): CompanyProfile => ({
  legalForm: "SARL",
  taxRegime: "ri",
  vatPayer: true,
  hasEmployees: true,
  sector: "commerce",
  capital: 10_000_000,
  ...o,
});

describe("Obligations — jours fériés", () => {
  it("calcule le dimanche de Pâques (vecteurs connus)", () => {
    expect(easterSunday(2024).toISOString().slice(0, 10)).toBe("2024-03-31");
    expect(easterSunday(2025).toISOString().slice(0, 10)).toBe("2025-04-20");
    expect(easterSunday(2026).toISOString().slice(0, 10)).toBe("2026-04-05");
  });

  it("liste les fériés fixes et mobiles du Togo", () => {
    const h = togoHolidays(2026);
    expect(h["2026-01-01"]).toBe("Nouvel An");
    expect(h["2026-04-27"]).toBe("Fête de l'Indépendance");
    expect(h["2026-04-06"]).toBe("Lundi de Pâques");
    expect(h["2026-05-14"]).toBe("Ascension");
    expect(h["2026-05-25"]).toBe("Lundi de Pentecôte");
    expect(h["2026-12-25"]).toBe("Noël");
  });

  it("reconnaît week-ends et fériés comme non ouvrés", () => {
    expect(isNonWorkingDay("2026-11-28")).toBe(true); // samedi
    expect(isNonWorkingDay("2026-11-29")).toBe(true); // dimanche
    expect(isNonWorkingDay("2026-12-25")).toBe(true); // Noël
    expect(isNonWorkingDay("2026-11-27")).toBe(false); // vendredi
  });
});

describe("Obligations — prorogation", () => {
  it("reporte un dimanche au lundi", () => {
    expect(nextBusinessDay("2026-03-15")).toEqual({ date: "2026-03-16", reason: "dimanche" });
  });

  it("reporte un samedi et enjambe le dimanche", () => {
    expect(nextBusinessDay("2026-08-15")).toEqual({ date: "2026-08-17", reason: "samedi" });
  });

  it("reporte un jour férié en nommant le motif", () => {
    expect(nextBusinessDay("2026-05-01")).toEqual({ date: "2026-05-04", reason: "Fête du Travail" });
  });

  it("laisse intacte une échéance ouvrée", () => {
    expect(nextBusinessDay("2026-11-16")).toEqual({ date: "2026-11-16", reason: null });
  });
});

describe("Obligations — échéances légales", () => {
  it("mensuelle : le 15 du mois suivant, même en janvier (bascule d'année)", () => {
    expect(computeMonthlyDueDate(2026, 11)).toBe("2027-01-15"); // décembre 2026
    expect(computeMonthlyDueDate(2026, 0)).toBe("2026-02-16"); // 15/02/2026 = dimanche
  });

  it("trimestrielle : T4 reporté en janvier N+1 (et non le 15 décembre)", () => {
    expect(computeQuarterlyDueDate(2026, 1)).toBe("2026-04-15");
    expect(computeQuarterlyDueDate(2026, 4)).toBe("2027-01-15");
  });

  it("annuelle : DAS au 31 janvier, IS au 31 mars, reportés si non ouvrés", () => {
    expect(computeAnnualDueDate("DAS_ANNUELLE", 2026)).toBe("2027-02-01"); // 31/01/2027 = dimanche
    expect(computeAnnualDueDate("IMPOT_BENEFICE", 2026)).toBe("2027-03-31");
  });
});

describe("Obligations — génération sur fenêtre", () => {
  it("ne génère que la fenêtre glissante, sans rétroactif massif", () => {
    const list = generateObligationInstances("c1", "Test", profile(), { today: "2026-11-28" });
    const overdue = list.filter((i) => i.status === "en_retard");
    expect(list.length).toBeGreaterThan(20);
    expect(list.every((i) => i.dueDate >= "2026-11-01")).toBe(true);
    // Seules les échéances du mois en cours peuvent être dépassées.
    expect(overdue.length).toBeLessThan(15);
    expect(overdue.every((i) => i.dueDate < "2026-11-28")).toBe(true);
    const fullYear = generateObligationInstances("c1", "Test", profile(), { from: "2026-01-01", until: "2026-12-31", today: "2026-11-28" });
    expect(fullYear.filter((i) => i.status === "en_retard").length).toBeGreaterThan(overdue.length);
  });

  it("respecte la fenêtre demandée et reste trié", () => {
    const list = generateObligationInstances("c1", "Test", profile(), { from: "2026-01-01", until: "2026-12-31", today: "2026-11-28" });
    expect(list.every((i) => i.dueDate >= "2026-01-01" && i.dueDate <= "2026-12-31")).toBe(true);
    const dates = list.map((i) => i.dueDate);
    expect([...dates].sort()).toEqual(dates);
    expect(list.some((i) => i.status === "en_retard")).toBe(true);
  });

  it("marque les reports au lieu de les cacher", () => {
    const list = generateObligationInstances("c1", "Test", profile(), { from: "2026-01-01", until: "2026-12-31", today: "2026-11-28" });
    const shifted = list.filter((i) => i.prorogatedFrom);
    expect(shifted.length).toBeGreaterThan(10);
    for (const i of shifted) {
      expect(isNonWorkingDay(i.prorogatedFrom!)).toBe(true);
      expect(i.dueDate > i.prorogatedFrom!).toBe(true);
      expect(isNonWorkingDay(i.dueDate)).toBe(false);
    }
  });

  it("désactive les obligations sociales sans salarié", () => {
    const withStaff = generateObligationInstances("c1", "Test", profile(), { from: "2026-01-01", until: "2026-12-31", today: "2026-11-28" });
    const without = generateObligationInstances("c1", "Test", profile({ hasEmployees: false }), { from: "2026-01-01", until: "2026-12-31", today: "2026-11-28" });
    expect(without.length).toBeLessThan(withStaff.length);
    expect(without.some((i) => i.organism === "CNSS")).toBe(false);
    expect(withStaff.some((i) => i.organism === "CNSS")).toBe(true);
  });

  it("accepte l'ancien appel par année (rétro-compatibilité)", () => {
    const list = generateObligationInstances("c1", "Test", profile(), 2026);
    expect(list.length).toBeGreaterThan(20);
    expect(list.every((i) => i.id.endsWith("_c1"))).toBe(true);
  });
});

describe("Obligations — synthèse et profil", () => {
  it("synthétise par organisme et expose ses limites", () => {
    const list = generateObligationInstances("c1", "Test", profile(), { from: "2026-01-01", until: "2026-12-31", today: "2026-11-28" });
    const s = summarizeObligations(list, { today: "2026-11-28", from: "2026-01-01", until: "2026-12-31" });
    expect(s.total).toBe(list.length);
    expect(s.byOrganism.OTR).toBeGreaterThan(0);
    expect(s.window.from).toBe("2026-01-01");
    expect(s.limits.length).toBe(3);
    expect(s.next30).toBeGreaterThanOrEqual(0);
  });

  it("dérive le profil réglementaire depuis l'entreprise", () => {
    const p = companyProfileFrom({ legalForm: "SARL", taxRegime: "ri", vatPayer: false, sector: "services", capital: 5_000_000 });
    expect(p.vatPayer).toBe(false);
    expect(p.hasEmployees).toBe(false);
    const r = determineApplicableObligations(p);
    expect(r.applicable.every((o) => o.applicableIf(p))).toBe(true);
    expect(r.notApplicable.length).toBeGreaterThan(0);
  });
});
