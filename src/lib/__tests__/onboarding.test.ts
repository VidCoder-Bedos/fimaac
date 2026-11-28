/**
 * P23 — Parcours d'amorçage.
 *
 * Avant : rien ne disait par où commencer. Le premier écran d'un cabinet neuf
 * ne distinguait pas « dossier vide » de « dossier prêt », et les six étapes
 * (cabinet → entreprise → exercice → écritures → contrôles → liasse) devaient
 * être devinées.
 *
 * Ici le parcours est **déduit de l'état réel** : aucune case à cocher, donc
 * aucun moyen de le déclarer terminé sans l'avoir fait.
 */
import { describe, it, expect } from "vitest";
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

describe("Parcours — un dossier neuf", () => {
  it("désigne le cabinet comme première étape, et rien d'autre", () => {
    const r = computeOnboarding(emptyDb(), null);
    expect(r.total).toBe(6);
    expect(r.done).toBe(0);
    expect(r.next?.id).toBe("organisation");
    expect(r.steps.filter((s) => s.status === "current").map((s) => s.id)).toEqual(["organisation"]);
    expect(r.complete).toBe(false);
    expect(r.summary).toContain("Étape 1 sur 6");
  });

  it("ne demande pas de préparer une liasse avant d'avoir des écritures", () => {
    const r = computeOnboarding(emptyDb(), null);
    expect(r.steps.find((s) => s.id === "liasse")!.status).toBe("todo");
  });

  it("chaque étape dit pourquoi elle existe et où aller", () => {
    const r = computeOnboarding(emptyDb(), null);
    for (const s of r.steps) {
      expect(s.why.length).toBeGreaterThan(30);
      expect(s.href.startsWith("/app")).toBe(true);
      expect(s.cta.length).toBeGreaterThan(3);
    }
  });
});

describe("Parcours — progression réelle", () => {
  it("avance étape par étape et s'arrête à la première qui manque", () => {
    const db = emptyDb();
    db.organizations = [{ id: "o1", name: "Cabinet Lumière" } as never];
    let r = computeOnboarding(db, null);
    expect(r.done).toBe(1);
    expect(r.next?.id).toBe("entreprise");

    db.companies = [{ id: "c1", name: "Alpha SARL", tradeName: "Alpha", nif: "1001234567", taxRegime: "ri" } as never];
    r = computeOnboarding(db, "c1");
    expect(r.done).toBe(2);
    expect(r.next?.id).toBe("exercice");
    expect(r.steps[1].hint).toContain("1001234567");
  });

  it("une balance déséquilibrée bloque l'étape des contrôles en le chiffrant", () => {
    const db = seedDatabase();
    const companyId = db.companies[0].id;
    const entry = JSON.parse(JSON.stringify(db.entries.find((e) => e.companyId === companyId)!));
    entry.lines[0].credit = entry.lines[0].credit + 100; // 100 FCFA qui ne s'équilibrent plus
    db.entries = [entry];
    const r = computeOnboarding(db, companyId);
    const controles = r.steps.find((s) => s.id === "controles")!;
    expect(controles.status).toBe("current");
    expect(controles.hint).toContain("100");
  });

  it("le dossier de démonstration va jusqu'au bout", () => {
    const db = seedDatabase();
    const r = computeOnboarding(db, db.companies[0].id);
    expect(r.complete).toBe(true);
    expect(r.done).toBe(6);
    expect(r.next).toBeNull();
    expect(r.summary).toContain("Parcours complet");
  });

  it("un dossier inconnu ne produit jamais un parcours complet", () => {
    const db = seedDatabase();
    const r = computeOnboarding(db, "dossier-inexistant");
    expect(r.complete).toBe(false);
    expect(r.next?.id).toBe("exercice");
  });
});
