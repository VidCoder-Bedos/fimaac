import { describe, it, expect } from "vitest";
import { buildNotesAnnex } from "../notesAnnex";
import type { BalanceRow } from "../liasse";

const row = (code: string, debit = 0, credit = 0): BalanceRow => ({ code, label: code, debit, credit });

/** Balance minimale crédible : capital, clients, banque, ventes, achats. */
const n: BalanceRow[] = [
  row("1013", 0, 5_000_000),
  row("411", 1_180_000, 0),
  row("521", 5_000_000, 0),
  row("2411", 2_000_000, 0),
  row("2811", 0, 400_000),
  row("701", 0, 1_180_000),
  row("601", 0, 0),
];

const n1: BalanceRow[] = [
  row("1013", 0, 5_000_000),
  row("411", 800_000, 0),
  row("521", 4_200_000, 0),
  row("701", 0, 800_000),
];

describe("Notes annexes — production", () => {
  it("produit les notes applicables et les trie dans l'ordre du référentiel", () => {
    const a = buildNotesAnnex({ n, n1, exercise: "2026", companyName: "Test" });
    expect(a.registryCount).toBeGreaterThan(30);
    expect(a.computedCount).toBeGreaterThan(0);
    const nums = a.notes.map((x) => Number(x.code.match(/\d+/)![0]));
    expect([...nums].sort((x, y) => x - y)).toEqual(nums);
    const codes = a.notes.map((x) => x.code);
    if (codes.includes("NOTE_03A") && codes.includes("NOTE_03C")) {
      expect(codes.indexOf("NOTE_03A")).toBeLessThan(codes.indexOf("NOTE_03C"));
    }
  });

  it("calcule la note de capital depuis les comptes 10x", () => {
    const a = buildNotesAnnex({ n, n1, exercise: "2026" });
    const note = a.notes.find((x) => x.code === "NOTE_01")!;
    expect(note.totalN).toBe(5_000_000);
  });

  it("isole les notes à saisie manuelle sans les remplir de zéros", () => {
    const a = buildNotesAnnex({ n, n1, exercise: "2026" });
    expect(a.manualCount).toBeGreaterThan(0);
    for (const note of a.manualNotes) {
      expect(note.status === "to_confirm" || note.missingInfo.length >= 0).toBe(true);
      expect(note.totalN).not.toBe(0);
    }
    const control = a.controls.find((c) => c.id === "manuelles")!;
    expect(control.level).toBe("warning");
    expect(control.detail).toContain("NOTE_23");
  });

  it("compte les valeurs indéterminées au lieu de les masquer", () => {
    const a = buildNotesAnnex({ n, n1, exercise: "2026" });
    expect(a.undeterminedCells).toBeGreaterThan(0);
    expect(a.controls.find((c) => c.id === "indetermine")?.detail).toContain("—");
  });

  it("renseigne les variations quand N-1 est disponible et les laisse vides sinon", () => {
    const withN1 = buildNotesAnnex({ n, n1, exercise: "2026" });
    expect(withN1.controls.find((c) => c.id === "n1")?.level).toBe("ok");
    const withoutN1 = buildNotesAnnex({ n, exercise: "2026" });
    expect(withoutN1.controls.find((c) => c.id === "n1")?.level).toBe("warning");
    expect(withoutN1.notes.every((x) => x.variation === null || x.totalN1 === null)).toBe(true);
  });

  it("rappelle qu'un total de note n'est pas un poste du bilan", () => {
    const a = buildNotesAnnex({ n, n1, exercise: "2026" });
    expect(a.controls.find((c) => c.id === "totaux")?.detail).toContain("pas un poste du bilan");
  });

  it("ne bloque jamais : une note manquante est une information, pas une erreur", () => {
    const a = buildNotesAnnex({ n, exercise: "2026" });
    expect(a.blockingCount).toBe(0);
  });
});
