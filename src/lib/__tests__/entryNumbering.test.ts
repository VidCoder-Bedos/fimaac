import { describe, it, expect } from "vitest";
import { parseEntryNumber, maxSequence, nextEntryNumber, auditNumbering } from "../entryNumbering";
import type { JournalEntry } from "../types";

const entry = (number: string, date = "2026-03-01", journalId = "j1") =>
  ({ id: number, number, date, journalId, companyId: "c1" }) as unknown as JournalEntry;

describe("Numérotation — analyse", () => {
  it("décompose un numéro préfixé", () => {
    expect(parseEntryNumber("ACH-0104")).toEqual({ prefix: "ACH", sequence: 104, suffix: "", width: 4 });
    expect(parseEntryNumber("ACH-0104-C")).toMatchObject({ prefix: "ACH", sequence: 104, suffix: "-C" });
    expect(parseEntryNumber("OD/0007")).toMatchObject({ prefix: "OD", sequence: 7 });
    expect(parseEntryNumber("LIBRE")).toEqual({ prefix: "LIBRE", sequence: null, suffix: "", width: 0 });
    expect(parseEntryNumber("")).toMatchObject({ sequence: null });
  });

  it("trouve la séquence maximale, extournes exclues", () => {
    expect(maxSequence(["ACH-0002", "ACH-0104", "ACH-0104-C"])).toBe(104);
    expect(maxSequence(["ACH-0002", "BAQ-0900"], "ACH")).toBe(2);
  });
});

describe("Numérotation — numéro suivant", () => {
  it("reprend après le maximum et non après le nombre d'écritures", () => {
    // Suppression d'écritures : 3 écritures, compteur à 104 → 105, jamais 4.
    expect(nextEntryNumber(["ACH-0001", "ACH-0002", "ACH-0104"], "ACH")).toBe("ACH-0105");
  });

  it("saute un numéro déjà pris", () => {
    expect(nextEntryNumber(["ACH-0104", "ACH-0105"], "ACH")).toBe("ACH-0106");
  });

  it("démarre à 0001 sur un journal vide", () => {
    expect(nextEntryNumber([], "OD")).toBe("OD-0001");
  });

  it("ignore les numéros des autres journaux", () => {
    expect(nextEntryNumber(["BAQ-0900", "ACH-0007"], "ACH")).toBe("ACH-0008");
  });

  it("ne recycle pas un numéro après suppression du dernier", () => {
    expect(nextEntryNumber(["ACH-0001", "ACH-0003"], "ACH")).toBe("ACH-0004");
  });
});

describe("Numérotation — contrôle d'intégrité", () => {
  it("détecte un doublon", () => {
    const audit = auditNumbering([entry("ACH-0001"), entry("ACH-0001")]);
    expect(audit.ok).toBe(false);
    expect(audit.duplicates[0]).toMatchObject({ number: "ACH-0001", count: 2 });
  });

  it("détecte les trous au sein d'un journal et d'une année", () => {
    const audit = auditNumbering([entry("ACH-0001"), entry("ACH-0004")]);
    expect(audit.ok).toBe(true); // un trou n'est pas une corruption
    expect(audit.gaps).toEqual([{ prefix: "ACH", year: "2026", missing: [2, 3] }]);
  });

  it("ne compte pas les extournes comme des trous", () => {
    const audit = auditNumbering([entry("ACH-0001"), entry("ACH-0001-C")]);
    expect(audit.gaps).toEqual([]);
    expect(audit.duplicates).toEqual([]);
  });

  it("signale un numéro illisible", () => {
    const audit = auditNumbering([entry("ACH-0001"), entry("SANS-NUMERO-")]);
    expect(audit.malformed.length).toBeGreaterThan(0);
    expect(audit.ok).toBe(false);
  });

  it("expose les séries par journal et par année", () => {
    const audit = auditNumbering([entry("ACH-0001"), entry("ACH-0002"), entry("ACH-0001", "2025-01-01")]);
    expect(audit.counters).toEqual([
      { prefix: "ACH", year: "2025", from: 1, to: 1, count: 1 },
      { prefix: "ACH", year: "2026", from: 1, to: 2, count: 2 },
    ]);
  });
});
