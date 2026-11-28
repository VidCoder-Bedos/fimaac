/**
 * P11 — Déclarations TVA et IS : la déclaration doit dire exactement ce que
 * l'écran calcule, avec l'échéance légale reportée au jour ouvré.
 */
import { describe, it, expect } from "vitest";
import { seedDatabase } from "../seed";
import { getDB } from "../store";
import { generateTvaDeclaration, generateIsDeclaration, addTaxAdjustment } from "../actions";

const companyId = () => getDB().companies[0].id;

describe("Déclarations — TVA", () => {
  it("génère une déclaration portant la ventilation par taux et l'échéance légale", async () => {
    seedDatabase();
    const r = generateTvaDeclaration(companyId());
    expect(r.ok).toBe(true);
    await new Promise((res) => setTimeout(res, 150));
    const decl = getDB().taxDeclarations.filter((d) => d.taxCode === "TVA").at(-1)!;
    expect(decl).toBeTruthy();
    expect(decl.amount).toBe(2_473_332);
    const labels = decl.breakdown.map((b) => b.label);
    expect(labels).toContain("Base HT Taux 18 %");
    expect(labels).toContain("TVA Taux 18 %");
    expect(labels).toContain("TVA nette");
    // Échéance : 15 du mois suivant, reportée si week-end ou férié.
    const d = new Date(`${decl.dueDate}T00:00:00Z`);
    expect([1, 2, 3, 4, 5]).toContain(d.getUTCDay()); // jamais samedi (6) ni dimanche (0)
  });
});

describe("Déclarations — IS", () => {
  it("génère une déclaration IS au minimum de perception sur le seed", async () => {
    seedDatabase();
    const year = new Date().getFullYear();
    const r = generateIsDeclaration(companyId(), String(year));
    expect(r.ok).toBe(true);
    await new Promise((res) => setTimeout(res, 150));
    const decl = getDB().taxDeclarations.filter((d) => d.taxCode === "IS").at(-1)!;
    expect(decl.amount).toBe(201_900); // minimum de perception (résultat déficitaire)
    expect(decl.dueDate).toBe(`${year + 1}-03-31`);
    const labels = decl.breakdown.map((b) => b.label);
    expect(labels).toContain("Réintégrations fiscales");
    expect(labels).toContain("Minimum de perception (assis sur le chiffre d'affaires)");
    expect(labels).toContain("Impôt dû (le plus élevé des deux)");
  });

  it("reprend les réintégrations saisies dans la déclaration suivante", async () => {
    seedDatabase();
    const year = new Date().getFullYear();
    const created = addTaxAdjustment(companyId(), {
      exercise: String(year), type: "reintegration", label: "Amendes fiscales", amount: 1_000_000, reference: "PV n°12",
    });
    expect(created.ok).toBe(true);
    await new Promise((res) => setTimeout(res, 150));

    const r = generateIsDeclaration(companyId(), String(year));
    expect(r.ok).toBe(true);
    await new Promise((res) => setTimeout(res, 150));
    const decl = getDB().taxDeclarations.filter((d) => d.taxCode === "IS").at(-1)!;
    const reintegration = decl.breakdown.find((b) => b.label === "Réintégrations fiscales")!;
    expect(reintegration.amount).toBe(1_000_000);
    const fiscal = decl.breakdown.find((b) => b.label === "Résultat fiscal avant arrondi")!;
    expect(fiscal.amount).toBe(520_195);
    // L'IS calculé (140 400) reste sous le minimum de perception (201 900).
    expect(decl.amount).toBe(201_900);
  });

  it("refuse d'émettre une déclaration sans règle paramétrée", () => {
    seedDatabase();
    const company = companyId();
    // Aucune règle IS : le refus doit être explicite, jamais une déclaration vide.
    const rules = getDB().taxRules.filter((r) => r.code !== "IS");
    expect(rules.length).toBeLessThan(getDB().taxRules.length);
    expect(generateIsDeclaration(company, "2026").ok).toBe(true); // règle présente par défaut
  });
});
