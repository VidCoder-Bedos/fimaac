/**
 * P24 — Écrans vides : dire ce qui manque.
 *
 * Avant : « Aucune écriture », « Aucune déclaration », « Importez une balance ».
 * C'est ce qu'on voit déjà. Le vide ne disait jamais *pourquoi* il est vide ni
 * *ce qu'il faut faire avant*.
 */
import { describe, it, expect } from "vitest";
import { explainMissing, missingFor, SCREEN_PREREQUISITES, SCREEN_LABELS, type ScreenId } from "../emptyStates";
import { computeOnboarding } from "../onboarding";
import { seedDatabase } from "../seed";
import type { DBState } from "../types";

const emptyDb = (): DBState => ({
  ...seedDatabase(),
  organizations: [],
  companies: [],
  fiscalYears: [],
  periods: [],
  entries: [],
  fsSessions: [],
} as DBState);

describe("Prérequis — déclaration par écran", () => {
  it("chaque écran déclare des prérequis qui existent vraiment dans le parcours", () => {
    const ids = new Set(computeOnboarding(emptyDb(), null).steps.map((s) => s.id));
    for (const screen of Object.keys(SCREEN_PREREQUISITES) as ScreenId[]) {
      expect(SCREEN_PREREQUISITES[screen].length).toBeGreaterThan(0);
      for (const p of SCREEN_PREREQUISITES[screen]) expect(ids.has(p)).toBe(true);
      expect(SCREEN_LABELS[screen].length).toBeGreaterThan(3);
    }
  });

  it("la liasse exige plus que les écritures : contrôles compris", () => {
    expect(SCREEN_PREREQUISITES.liasse).toContain("controles");
    expect(SCREEN_PREREQUISITES.ecritures).not.toContain("controles");
  });
});

describe("Message — le premier manque, pas tous", () => {
  it("sur un dossier vide, l'écran écritures réclame l'entreprise", () => {
    const m = missingFor("ecritures", emptyDb(), null)!;
    expect(m.step.id).toBe("entreprise");
    expect(m.message).toContain("les écritures");
    expect(m.message).toContain("l'entreprise");
    expect(m.href).toBe("/app/entreprises");
  });

  it("sur la liasse d'un dossier sans exercice, c'est l'exercice qui est nommé", () => {
    const db = emptyDb();
    db.organizations = [{ id: "o1", name: "Cabinet" } as never];
    db.companies = [{ id: "c1", name: "Alpha", nif: "100", taxRegime: "ri" } as never];
    const m = missingFor("liasse", db, "c1")!;
    expect(m.step.id).toBe("exercice");
    expect(m.message).toContain("la liasse");
  });

  it("un écran dont tous les prérequis sont remplis ne renvoie rien", () => {
    const db = seedDatabase();
    const report = computeOnboarding(db, db.companies[0].id);
    expect(explainMissing("liasse", report)).toBeNull();
    expect(explainMissing("ecritures", report)).toBeNull();
  });

  it("une balance déséquilibrée suffit à expliquer le vide de la liasse", () => {
    const db = seedDatabase();
    const companyId = db.companies[0].id;
    const entry = JSON.parse(JSON.stringify(db.entries.find((e) => e.companyId === companyId)!));
    entry.lines[0].credit += 250;
    db.entries = [entry];
    const m = missingFor("liasse", db, companyId)!;
    expect(m.step.id).toBe("controles");
    expect(m.message).toContain("250");
  });

  it("le message reste court et actionnable", () => {
    const m = missingFor("fiscalite", emptyDb(), null)!;
    expect(m.message.length).toBeLessThan(220);
    expect(m.cta.length).toBeGreaterThan(3);
    expect(m.href.startsWith("/app")).toBe(true);
  });
});
