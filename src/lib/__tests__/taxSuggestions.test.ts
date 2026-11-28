/**
 * P20 — Réintégrations proposées depuis les comptes de nature non déductible.
 *
 * Avant : il fallait savoir que 647 (pénalités) et 6582 (dons) ne sont pas
 * déductibles, retrouver les montants dans la balance et recopier le total à la
 * main. Désormais le logiciel signale, avec sa raison ; le fiscaliste décide, et
 * sa décision est tracée.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { suggestAdjustments, describeSuggestions, SUGGESTION_RULES, type TaxSuggestion } from "../taxSuggestions";
import { addTaxAdjustment } from "../actions";
import { seedDatabase } from "../seed";
import { getDB, resetDB } from "../store";
import type { TaxAdjustment } from "../types";

const row = (code: string, label: string, debit: number, credit = 0.0) => ({ code, label, debit, credit });
const adj = (o: Partial<TaxAdjustment>): TaxAdjustment => ({
  id: "a", companyId: "c", exercise: "2026", type: "reintegration", label: "x", amount: 1,
  authorId: "u", createdAt: "", ...o,
});

describe("Propositions — détection", () => {
  it("propose les pénalités et les dons, avec leur montant et leur raison", () => {
    const list = suggestAdjustments([
      row("6471", "Pénalités d'assiette, impôts directs", 150_000),
      row("6473", "Pénalités de recouvrement", 50_000),
      row("6582", "Dons", 200_000),
      row("601", "Achats", 9_000_000),
    ], [], "2026");
    const penalites = list.find((s) => s.id.startsWith("penalites"))!;
    const dons = list.find((s) => s.id.startsWith("dons"))!;
    expect(penalites.amount).toBe(200_000);
    expect(penalites.accounts.map((a) => a.code)).toEqual(["6471", "6473"]);
    expect(penalites.rationale).toContain("ne concourent pas à la formation du résultat imposable");
    expect(dons.amount).toBe(200_000);
    expect(list.every((s) => s.type === "reintegration")).toBe(true);
  });

  it("ne propose jamais un montant nul et ignore les comptes créditeurs", () => {
    const list = suggestAdjustments([row("6471", "Pénalités", 100_000, 100_000), row("6472", "Pénalités", 0)], [], "2026");
    expect(list).toEqual([]);
  });

  it("ne propose pas ce qui a déjà été repris pour l'exercice", () => {
    const existing = [adj({ suggestionId: "penalites/2026", exercise: "2026", amount: 200_000 })];
    const list = suggestAdjustments([row("6471", "Pénalités", 200_000)], existing, "2026");
    expect(list[0].alreadyRecorded).toBe(true);
    // Une reprise sur un autre exercice ne vaut pas pour celui-ci.
    const other = suggestAdjustments([row("6471", "Pénalités", 200_000)], [adj({ suggestionId: "penalites/2026", exercise: "2025" })], "2026");
    expect(other[0].alreadyRecorded).toBe(false);
  });

  it("reste silencieux sur un dossier sans compte concerné", () => {
    expect(suggestAdjustments([row("601", "Achats", 1)], [], "2026")).toEqual([]);
    expect(describeSuggestions([])).toContain("Aucun compte");
  });

  it("résume ce qui reste à décider", () => {
    const list: TaxSuggestion[] = [
      { id: "a", label: "A", type: "reintegration", amount: 150_000, rationale: "", reference: "", accounts: [], alreadyRecorded: false },
      { id: "b", label: "B", type: "reintegration", amount: 50_000, rationale: "", reference: "", accounts: [], alreadyRecorded: true },
    ];
    expect(describeSuggestions(list)).toContain("1 proposition(s)");
    expect(describeSuggestions(list.map((s) => ({ ...s, alreadyRecorded: true })))).toContain("Toutes les propositions");
  });

  it("le catalogue ne propose que des réintégrations et cite ses comptes", () => {
    expect(SUGGESTION_RULES.length).toBeGreaterThanOrEqual(2);
    for (const r of SUGGESTION_RULES) {
      expect(r.type).toBe("reintegration");
      expect(r.prefixes.length).toBeGreaterThan(0);
      expect(r.rationale.length).toBeGreaterThan(20);
    }
  });
});

describe("Propositions — reprise et traçabilité", () => {
  beforeEach(() => {
    resetDB();
  });

  it("enregistre la réintégration avec son origine, et la retire des propositions", async () => {
    const db = getDB();
    const companyId = db.companies[0].id;
    const suggestion = suggestAdjustments([row("6478", "Autres amendes", 300_000)], db.taxAdjustments, "2026")[0];

    const res = addTaxAdjustment(companyId, {
      exercise: "2026", type: suggestion.type, label: suggestion.label,
      amount: suggestion.amount, reference: suggestion.reference, suggestionId: suggestion.id,
    });
    expect(res.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 150));

    const after = getDB();
    const saved = after.taxAdjustments.find((a) => a.suggestionId === suggestion.id)!;
    expect(saved.amount).toBe(300_000);
    expect(saved.reference).toBe("Comptes 647x");
    expect(after.auditLogs[0].after).toContain("proposition penalites/2026 reprise");

    const again = suggestAdjustments([row("6478", "Autres amendes", 300_000)], after.taxAdjustments, "2026");
    expect(again[0].alreadyRecorded).toBe(true);
  });

  it("la saisie libre reste possible et n'est pas marquée comme reprise", async () => {
    const companyId = getDB().companies[0].id;
    addTaxAdjustment(companyId, { exercise: "2026", type: "reintegration", label: "Charge non justifiée", amount: 75_000 });
    await new Promise((r) => setTimeout(r, 150));
    expect(getDB().taxAdjustments[0].suggestionId).toBeUndefined();
  });

  it("le seed ne contient ni retraitement ni compte non déductible", () => {
    const db = seedDatabase();
    expect(db.taxAdjustments).toEqual([]);
    const codes = db.accounts.filter((a) => /^(647|6582|6583|835|6581)/.test(a.code)).map((a) => a.code);
    // Les comptes existent au plan comptable, mais aucune écriture ne les mouvemente dans le seed.
    expect(codes.length).toBeGreaterThan(0);
  });
});
