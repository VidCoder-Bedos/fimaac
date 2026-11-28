/**
 * P21 — Portée des règles fiscales : le régime déclaré décide.
 *
 * Avant : `company.taxRegime` était saisi, affiché… et jamais lu par un calcul.
 * Une entreprise déclarée exonérée voyait un IS et une TVA à payer ; une
 * entreprise au forfait voyait le calcul du régime réel présenté comme le sien.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resolveTaxRule, ruleMatchesProfile, describeProfile, validateCategory, TAX_REGIME_LABELS } from "../taxRegime";
import { setCompanyTaxProfile, generateIsDeclaration, generateTvaDeclaration } from "../actions";
import { getDB, resetDB } from "../store";
import type { TaxRuleRef } from "../types";

const rule = (o: Partial<TaxRuleRef>): TaxRuleRef => ({
  id: "r", code: "IS", name: "IS", rate: 27, base: "amount", country: "TG",
  source: "CGI", version: "1", verified: false, ...o,
});

describe("Portée — sélection de la règle", () => {
  it("préfère la règle propre au régime déclaré", () => {
    const rules = [
      rule({ id: "g", rate: 27 }),
      rule({ id: "forf", rate: 5, regimes: ["rsmi"], verified: true }),
      rule({ id: "ri", rate: 27, regimes: ["ri"] }),
    ];
    const res = resolveTaxRule(rules, "IS", { regime: "rsmi" });
    expect(res.rule?.id).toBe("forf");
    expect(res.status).toBe("ok");
    expect(res.indicativeOnly).toBe(false);
  });

  it("n'applique jamais la règle d'un autre régime à un régime sans règle", () => {
    const res = resolveTaxRule([rule({ id: "ri", regimes: ["ri"] })], "IS", { regime: "rsmi" });
    expect(res.rule).toBeNull();
    expect(res.status).toBe("regime_missing");
    expect(res.shouldCompute).toBe(false);
    expect(res.message).toContain("RSMI");
    expect(res.message).toContain("Réel normal");
  });

  it("applique la règle générique en l'annonçant", () => {
    const res = resolveTaxRule([rule({ id: "g", rate: 27 })], "IS", { regime: "ri" });
    expect(res.rule?.id).toBe("g");
    expect(res.status).toBe("generic");
    expect(res.indicativeOnly).toBe(true);
    expect(res.message).toContain("générique");
  });

  it("un régime exonéré ne calcule rien du tout", () => {
    const res = resolveTaxRule([rule({ id: "g", code: "TVA" })], "TVA", { regime: "exempt" });
    expect(res.rule).toBeNull();
    expect(res.status).toBe("exempt");
    expect(res.shouldCompute).toBe(false);
    expect(res.message).toContain("exonéré");
  });

  it("un régime exonéré doté d'une règle propre reste calculable (exonération partielle)", () => {
    const res = resolveTaxRule([rule({ id: "ex", code: "TVA", regimes: ["exempt"], rate: 0 })], "TVA", { regime: "exempt" });
    expect(res.status).toBe("ok");
    expect(res.shouldCompute).toBe(true);
  });

  it("les taux différenciés par catégorie s'appliquent, et pas aux autres", () => {
    const rules = [rule({ id: "pme", rate: 25, categories: ["PME"] }), rule({ id: "g", rate: 27 })];
    expect(resolveTaxRule(rules, "IS", { regime: "ri", category: "PME" }).rule?.id).toBe("pme");
    const autre = resolveTaxRule(rules, "IS", { regime: "ri", category: "Grande entreprise" });
    expect(autre.rule?.id).toBe("g");
    expect(autre.status).toBe("generic");
  });

  it("une règle catégorielle ne fuit pas vers un dossier sans catégorie", () => {
    const rules = [rule({ id: "pme", categories: ["PME"] })];
    const res = resolveTaxRule(rules, "IS", { regime: "ri" });
    expect(res.rule).toBeNull();
    expect(res.status).toBe("regime_missing");
    expect(ruleMatchesProfile(rules[0], { regime: "ri" })).toBe(false);
  });

  it("signale l'absence totale de règle", () => {
    const res = resolveTaxRule([], "TVA", { regime: "ri" });
    expect(res.status).toBe("no_rule");
    expect(res.shouldCompute).toBe(false);
  });

  it("les libellés couvrent les cinq régimes déclarables", () => {
    expect(Object.keys(TAX_REGIME_LABELS).sort()).toEqual(["exempt", "ri", "rnc", "rs", "rsmi"]);
    expect(describeProfile({ regime: "ri", category: "PME" })).toBe("Régime Réel normal · PME");
    expect(validateCategory("x".repeat(41)).ok).toBe(false);
  });
});

describe("Portée — effets sur le dossier", () => {
  beforeEach(() => {
    resetDB();
  });

  it("déclarer « exonéré » bloque la génération des déclarations TVA et IS", async () => {
    const db = getDB();
    const companyId = db.companies[0].id;
    expect(setCompanyTaxProfile(companyId, { taxRegime: "exempt" }).ok).toBe(true);
    await new Promise((r) => setTimeout(r, 150));
    expect(getDB().companies[0].taxRegime).toBe("exempt");

    const tva = generateTvaDeclaration(companyId);
    expect(tva.ok).toBe(false);
    expect(tva.error).toContain("exonéré");
    const is = generateIsDeclaration(companyId, "2026");
    expect(is.ok).toBe(false);
    expect(is.error).toContain("exonéré");
  });

  it("le profil déclaré est audité, et une redite ne crée pas d'entrée", async () => {
    const companyId = getDB().companies[0].id;
    setCompanyTaxProfile(companyId, { taxRegime: "ri", taxCategory: "PME" });
    await new Promise((r) => setTimeout(r, 150));
    const after = getDB();
    expect(after.companies[0].taxCategory).toBe("PME");
    expect(after.auditLogs[0].action).toBe("COMPANY_TAX_PROFILE_UPDATE");
    expect(after.auditLogs[0].after).toContain("PME");

    const before = after.auditLogs.length;
    expect(setCompanyTaxProfile(companyId, { taxRegime: "ri", taxCategory: "PME" }).ok).toBe(true);
    await new Promise((r) => setTimeout(r, 150));
    expect(getDB().auditLogs.length).toBe(before);
  });

  it("refuse un régime inconnu et une catégorie démesurée", () => {
    const companyId = getDB().companies[0].id;
    expect(setCompanyTaxProfile(companyId, { taxRegime: "micro" }).ok).toBe(false);
    expect(setCompanyTaxProfile(companyId, { taxRegime: "ri", taxCategory: "y".repeat(50) }).ok).toBe(false);
    expect(getDB().companies[0].taxCategory).toBeUndefined();
  });

  it("le dossier de démonstration conserve son régime déclaré au seed", () => {
    expect(["ri", "rs", "rsmi", "rnc", "exempt"]).toContain(getDB().companies[0].taxRegime);
    expect(getDB().companies[0].taxCategory).toBeUndefined();
  });
});
