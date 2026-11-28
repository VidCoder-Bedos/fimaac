/**
 * P17 — Les 15 notes à saisie manuelle doivent pouvoir être complétées.
 *
 * Elles restaient « à compléter » à perpétuité : aucune donnée de balance ne les
 * produit, et aucun écran ne permettait de les renseigner. La liasse ne pouvait
 * donc jamais être déposée complète. La saisie est désormais possible, datée,
 * attribuée — et une ligne vide reste vide.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { seedDatabase } from "../seed";
import { getDB, resetDB } from "../store";
import { buildNotesAnnex } from "../notesAnnex";
import { saveManualNote, clearManualNote } from "../actions";
import {
  normalizeRows, filledRowCount, isNoteComplete, mergeWithExpected, totalOf, manualNotesFor, describeCompletion,
} from "../manualNotes";
import { movementsByAccount } from "../accounting";

const db = seedDatabase();
const cid = db.companies[0].id;
const rows = [...movementsByAccount(db.entries.filter((e) => e.companyId === cid))]
  .map(([code, m]) => ({ code, label: "", debit: m.debit, credit: m.credit }));
const build = (manualValues?: Map<string, { rows: { label: string; n: number | null; n1: number | null }[]; updatedAt: string }>) =>
  buildNotesAnnex({ n: rows, accounts: db.accounts, companyName: "Technologie Lomé", exercise: "2026", manualValues });

describe("Saisie — normalisation", () => {
  it("accepte les espaces, la virgule et arrondit au franc", () => {
    const out = normalizeRows([
      { label: "Total", n: "1 250 000,4", n1: "0" },
      { label: "Vide", n: "", n1: null },
    ]);
    expect(out[0]).toEqual({ label: "Total", n: 1_250_000, n1: 0 });
    expect(out[1]).toEqual({ label: "Vide", n: null, n1: null });
  });

  it("ne convertit pas un texte non numérique en 0", () => {
    expect(normalizeRows([{ label: "X", n: "néant", n1: "" }])[0].n).toBeNull();
  });

  it("compte les lignes utiles et juge la complétude", () => {
    const rows = [
      { label: "a", n: 10, n1: null },
      { label: "b", n: null, n1: 5 },
    ];
    expect(filledRowCount(rows)).toBe(2);
    expect(isNoteComplete(rows)).toBe(false);
    expect(isNoteComplete([{ label: "a", n: 0, n1: null }])).toBe(true); // un vrai 0 saisi compte
  });

  it("garde les lignes attendues vides et conserve les lignes ajoutées", () => {
    const merged = mergeWithExpected(["A", "B"], [{ label: "B", n: 42, n1: null }, { label: "C", n: 7, n1: null }]);
    expect(merged.map((r) => [r.label, r.n])).toEqual([["A", null], ["B", 42], ["C", 7]]);
  });

  it("rend null plutôt que 0 quand rien n'est saisi", () => {
    expect(totalOf([{ label: "A", n: null, n1: null }], "n")).toBeNull();
    expect(totalOf([{ label: "A", n: 0, n1: null }], "n")).toBe(0);
  });

  it("résume ce qui reste à saisir", () => {
    expect(describeCompletion([{ code: "NOTE_18", rows: [{ label: "a", n: null, n1: null }] }])).toContain("restent 18");
    expect(describeCompletion([])).toBe("Aucune note à saisie manuelle.");
  });
});

describe("Saisie — effet sur la liasse", () => {
  it("une note non saisie reste « à compléter », sans valeur", () => {
    const annex = build();
    const note = annex.manualNotes.find((n) => n.code === "NOTE_18")!;
    expect(note.entered).toBeUndefined();
    expect(note.totalN).toBeNull();
    expect(annex.manualCount).toBe(15);
  });

  it("une note saisie porte ses valeurs, son total et son horodatage", () => {
    const annex = build(new Map([["NOTE_18", {
      rows: [
        { label: "Engagements de financement obtenus", n: 5_000_000, n1: 4_000_000 },
        { label: "Engagements de garantie obtenus", n: 1_000_000, n1: null },
      ],
      updatedAt: "2026-11-28T10:00:00.000Z",
    }]]));
    const note = annex.manualNotes.find((n) => n.code === "NOTE_18")!;
    expect(note.entered).toBe(true);
    expect(note.totalN).toBe(6_000_000);
    expect(note.totalN1).toBe(4_000_000);
    expect(note.enteredAt).toBe("2026-11-28T10:00:00.000Z");
    // Les deux lignes attendues non saisies restent vides, pas à zéro.
    expect(note.rows.filter((r) => r.n === null).length).toBe(2);
    expect(note.complete).toBe(false);
  });

  it("les notes calculées ne changent pas", () => {
    const annex = build(new Map([["NOTE_18", { rows: [{ label: "Engagements de financement obtenus", n: 1, n1: null }], updatedAt: "2026-11-28" }]]));
    expect(annex.notes.find((n) => n.code === "NOTE_04")!.totalN).toBe(15_167_298);
    expect(annex.computedCount).toBe(13);
    expect(annex.controls.find((c) => c.id === "manuelles")!.detail).toContain("déjà saisie(s)");
  });
});

describe("Saisie — persistance et traçabilité", () => {
  beforeEach(() => {
    resetDB();
  });

  it("enregistre la saisie, la date et l'attribue au journal d'audit", async () => {
    const companyId = getDB().companies[0].id;
    const res = saveManualNote(companyId, "2026", "NOTE_29", [
      { label: "CA — activités de services", n: "12 000 000", n1: "" },
      { label: "CA — activités de négoce", n: "", n1: "" },
    ]);
    expect(res.ok).toBe(true);
    expect(res.filled).toBe(1);
    await new Promise((r) => setTimeout(r, 150));
    const after = getDB();
    expect(after.manualNotes).toHaveLength(1);
    expect(after.manualNotes[0].rows[0].n).toBe(12_000_000);
    expect(after.manualNotes[0].rows[1].n).toBeNull();
    expect(after.auditLogs[0].action).toBe("SAISIE_NOTE");
    expect(after.auditLogs[0].after).toContain("NOTE_29");
  });

  it("remplace la saisie existante au lieu de la dupliquer", async () => {
    const companyId = getDB().companies[0].id;
    saveManualNote(companyId, "2026", "NOTE_29", [{ label: "CA — activités de services", n: 1, n1: null }]);
    await new Promise((r) => setTimeout(r, 120));
    saveManualNote(companyId, "2026", "NOTE_29", [{ label: "CA — activités de services", n: 2, n1: null }]);
    await new Promise((r) => setTimeout(r, 120));
    expect(getDB().manualNotes).toHaveLength(1);
    expect(getDB().manualNotes[0].rows[0].n).toBe(2);
  });

  it("refuse une note calculée, un exercice mal formé et une saisie entièrement vide", () => {
    const companyId = getDB().companies[0].id;
    expect(saveManualNote(companyId, "2026", "NOTE_04", [{ label: "x", n: 1, n1: null }]).ok).toBe(false);
    expect(saveManualNote(companyId, "26", "NOTE_18", [{ label: "x", n: 1, n1: null }]).ok).toBe(false);
    expect(saveManualNote(companyId, "2026", "NOTE_18", [{ label: "x", n: "", n1: "" }]).ok).toBe(false);
  });

  it("sépare les exercices et les sociétés", async () => {
    const db = getDB();
    const companyId = db.companies[0].id;
    saveManualNote(companyId, "2026", "NOTE_18", [{ label: "a", n: 100, n1: null }]);
    saveManualNote(companyId, "2025", "NOTE_18", [{ label: "a", n: 50, n1: null }]);
    await new Promise((r) => setTimeout(r, 150));
    const map2026 = manualNotesFor(getDB().manualNotes, companyId, "2026");
    expect(map2026.size).toBe(1);
    expect(map2026.get("NOTE_18")!.rows[0].n).toBe(100);
  });

  it("efface une saisie : la note redevient à compléter", async () => {
    const companyId = getDB().companies[0].id;
    saveManualNote(companyId, "2026", "NOTE_18", [{ label: "a", n: 100, n1: null }]);
    await new Promise((r) => setTimeout(r, 120));
    expect(clearManualNote(companyId, "2026", "NOTE_18").ok).toBe(true);
    await new Promise((r) => setTimeout(r, 120));
    expect(getDB().manualNotes).toHaveLength(0);
    expect(getDB().auditLogs[0].action).toBe("SUPPR_NOTE");
  });
});
