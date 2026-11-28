/**
 * P16 — Éclatement par compte des notes clients et dettes fiscales.
 *
 * NOTE_04 affichait « Clients 15 167 298 » sans dire quels comptes la composaient :
 * le réviseur devait refaire la balance à la main pour vérifier une seule ligne.
 * Le détail est désormais produit par le même agrégat que la ligne.
 */
import { describe, it, expect } from "vitest";
import { seedDatabase } from "../seed";
import { buildNotesAnnex } from "../notesAnnex";
import { movementsByAccount } from "../accounting";

const db = seedDatabase();
const cid = db.companies[0].id;
const rows = [...movementsByAccount(db.entries.filter((e) => e.companyId === cid))]
  .map(([code, m]) => ({ code, label: db.accounts.find((a) => a.code === code)?.label || "", debit: m.debit, credit: m.credit }));
const annex = buildNotesAnnex({ n: rows, accounts: db.accounts, companyName: "Technologie Lomé", exercise: "2026" });
const note = (code: string) => annex.notes.find((n) => n.code === code)!;

describe("Notes — détail par compte", () => {
  it("conserve le total de NOTE_04", () => {
    expect(note("NOTE_04").totalN).toBe(15_167_298);
  });

  it("donne au compte 411 son détail et la somme qui va avec", () => {
    const line = note("NOTE_04").rows.find((r) => r.ref === "411")!;
    expect(line).toBeTruthy();
    expect(line.details?.length).toBeGreaterThan(0);
    const sum = line.details!.reduce((s, d) => s + (d.n ?? 0), 0);
    expect(sum).toBe(line.n);
    expect(line.details!.some((d) => d.code === "4111")).toBe(true);
  });

  it("n'invente aucune ligne à zéro", () => {
    for (const n of annex.notes) {
      for (const r of n.rows) {
        for (const d of r.details ?? []) {
          expect(d.n).not.toBe(0);
        }
      }
    }
  });

  it("étiquette chaque compte du plan comptable, et nomme les autres par leur code", () => {
    const details = note("NOTE_16A").rows.flatMap((r) => r.details ?? []);
    expect(details.length).toBeGreaterThan(0);
    for (const d of details) {
      const known = db.accounts.find((a) => a.code === d.code);
      expect(d.label).toBe(known ? known.label : `Compte ${d.code}`);
      expect(d.label.length).toBeGreaterThan(0);
    }
  });

  it("la somme des détails de NOTE_16A égale son total", () => {
    const n16 = note("NOTE_16A");
    const sum = n16.rows.reduce((s, r) => s + (r.details ?? []).reduce((t, d) => t + (d.n ?? 0), 0), 0);
    expect(sum).toBe(n16.totalN);
  });

  it("chaque détail porte un compte unique dans sa ligne", () => {
    for (const n of annex.notes) {
      for (const r of n.rows) {
        const codes = (r.details ?? []).map((d) => d.code);
        expect(new Set(codes).size).toBe(codes.length);
      }
    }
  });

  it("les autres notes restent inchangées : aucune n'est éclatée par accident", () => {
    const withDetails = annex.notes.filter((n) => n.rows.some((r) => r.details && r.details.length > 0)).map((n) => n.code);
    expect(withDetails.sort()).toEqual(["NOTE_04", "NOTE_16A"]);
    // Le référentiel ne bouge pas : 13 notes calculées, 15 à saisir, 38 au
    // référentiel (les autres ne s'appliquent pas sans balance N-1).
    expect(annex.computedCount).toBe(13);
    expect(annex.manualCount).toBe(15);
    expect(annex.registryCount).toBe(38);
    expect(annex.notes.length + annex.manualNotes.length).toBeLessThanOrEqual(annex.registryCount);
  });
});
