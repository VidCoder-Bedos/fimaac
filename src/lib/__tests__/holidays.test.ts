/**
 * P18 — Jours fériés exceptionnels et prorogations.
 *
 * Les fêtes musulmanes (Aïd el-Fitr, Aïd el-Adha) et les prorogations décidées
 * par l'administration ne se calculent pas : la conversion du calendrier
 * hégirien dépend de l'observation. Le moteur les ignorait donc, et une échéance
 * tombant un de ces jours n'était pas reportée.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  computeMonthlyDueDate, computeAnnualDueDate, nextBusinessDay,
  isNonWorkingDay, holidaysWithExtras,
} from "../obligations";
import { seedDatabase } from "../seed";
import { getDB, resetDB } from "../store";
import { addHoliday, removeHoliday, holidayMonthMap } from "../actions";

describe("Calendrier — jours fériés saisis", () => {
  it("ne change rien sans déclaration", () => {
    expect(computeMonthlyDueDate(2026, 2)).toBe("2026-04-15"); // 15/04/2026 = mercredi
    expect(nextBusinessDay("2026-04-15")).toEqual({ date: "2026-04-15", reason: null });
  });

  it("reporte une échéance tombant un jour férié déclaré", () => {
    const extras = { "2026-04-15": "Aïd el-Fitr" };
    expect(computeMonthlyDueDate(2026, 2, extras)).toBe("2026-04-16");
    expect(nextBusinessDay("2026-04-15", extras)).toEqual({ date: "2026-04-16", reason: "Aïd el-Fitr" });
  });

  it("cumule les reports quand le lendemain est aussi non ouvré", () => {
    // 15/04/2026 férié déclaré, 16/04 férié légal (?) : on déclare les deux jours.
    const extras = { "2026-04-15": "Aïd el-Fitr", "2026-04-16": "Pont", "2026-04-17": "Pont" };
    expect(computeMonthlyDueDate(2026, 2, extras)).toBe("2026-04-20"); // 18-19 = week-end
  });

  it("reconnaît le jour comme non ouvré et le nomme", () => {
    const extras = { "2026-05-27": "Aïd el-Adha" };
    expect(isNonWorkingDay("2026-05-27", extras)).toBe(true);
    expect(holidaysWithExtras(2026, extras)["2026-05-27"]).toBe("Aïd el-Adha");
    // Un jour férié d'une autre année ne contamine pas le calendrier.
    expect(holidaysWithExtras(2026, { "2025-05-27": "Aïd el-Adha" })["2025-05-27"]).toBeUndefined();
  });

  it("reporte aussi l'échéance annuelle", () => {
    const extras = { "2027-03-31": "Prorogation exceptionnelle" };
    expect(computeAnnualDueDate("IMPOT_BENEFICE", 2026)).toBe("2027-03-31");
    expect(computeAnnualDueDate("IMPOT_BENEFICE", 2026, extras)).toBe("2027-04-01");
  });

  it("une déclaration sur un samedi ne déplace rien de plus", () => {
    const extras = { "2026-08-15": "Assomption reportée" }; // déjà samedi
    expect(computeMonthlyDueDate(2026, 6, extras)).toBe(computeMonthlyDueDate(2026, 6));
  });
});

describe("Calendrier — persistance", () => {
  beforeEach(() => {
    resetDB();
  });

  it("le seed ne contient aucune date inventée", () => {
    expect(seedDatabase().holidays).toEqual([]);
    expect(holidayMonthMap()).toEqual({});
  });

  it("déclare un jour férié, le date et l'audite", async () => {
    const r = addHoliday("2026-03-20", "Aïd el-Fitr", "Communiqué OTR n°2026-14");
    expect(r.ok).toBe(true);
    await new Promise((res) => setTimeout(res, 150));
    const db = getDB();
    expect(db.holidays).toHaveLength(1);
    expect(db.holidays[0].date).toBe("2026-03-20");
    expect(db.holidays[0].reference).toContain("OTR");
    expect(db.auditLogs[0].action).toBe("ADD_HOLIDAY");
    expect(holidayMonthMap()).toEqual({ "2026-03-20": "Aïd el-Fitr" });
  });

  it("refuse une date invalide, un libellé vide et un doublon", async () => {
    addHoliday("2026-03-20", "Aïd el-Fitr");
    await new Promise((res) => setTimeout(res, 120));
    expect(addHoliday("20/03/2026", "Aïd el-Fitr").ok).toBe(false);
    expect(addHoliday("2026-03-20", "   ").ok).toBe(false);
    expect(addHoliday("2026-03-20", "Aïd el-Fitr").ok).toBe(false);
    expect(getDB().holidays).toHaveLength(1);
  });

  it("retire un jour férié et rend l'échéance à sa date légale", async () => {
    addHoliday("2026-04-15", "Aïd el-Fitr");
    await new Promise((res) => setTimeout(res, 120));
    expect(computeMonthlyDueDate(2026, 2, holidayMonthMap())).toBe("2026-04-16");
    const id = getDB().holidays[0].id;
    expect(removeHoliday(id).ok).toBe(true);
    await new Promise((res) => setTimeout(res, 120));
    expect(holidayMonthMap()).toEqual({});
    expect(computeMonthlyDueDate(2026, 2, holidayMonthMap())).toBe("2026-04-15");
    expect(getDB().auditLogs[0].action).toBe("REMOVE_HOLIDAY");
    expect(removeHoliday("inconnu").ok).toBe(false);
  });
});
