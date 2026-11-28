import { describe, it, expect } from "vitest";
import { ventilateVat, rateFromTaxCode, snapRate } from "../tvaVentilation";
import type { Account, JournalEntry } from "../types";

const accounts: Account[] = [];

type Line = Partial<JournalEntry["lines"][number]>;

const entry = (number: string, lines: Line[], status: JournalEntry["status"] = "validated"): JournalEntry =>
  ({
    id: number,
    number,
    journalId: "j",
    companyId: "c",
    date: "2026-03-31",
    label: number,
    reference: number,
    status,
    updatedAt: "2026-03-31T00:00:00Z",
    lines: lines.map((l, i) => ({
      id: `${number}-${i}`,
      accountId: "701",
      label: "",
      debit: 0,
      credit: 0,
      taxCode: null,
      thirdPartyId: null,
      analytic: null,
      ...l,
    })),
  }) as unknown as JournalEntry;

describe("TVA — résolution des taux", () => {
  it("lit les codes explicites et les taux numériques", () => {
    expect(rateFromTaxCode("TVA18")).toBe(18);
    expect(rateFromTaxCode("tva9")).toBe(9);
    expect(rateFromTaxCode("EXO")).toBe(0);
    expect(rateFromTaxCode("18")).toBe(18);
    expect(rateFromTaxCode("9,5")).toBe(9.5);
    expect(rateFromTaxCode("TVA_BIDON")).toBeNull();
    expect(rateFromTaxCode(null)).toBeNull();
  });

  it("rattache un taux effectif au taux paramétré le plus proche", () => {
    expect(snapRate(17.98, [18, 9, 0], 0.5)).toEqual({ rate: 18, ecart: 0.02 });
    expect(snapRate(9.1, [18, 9, 0], 0.5)?.rate).toBe(9);
    expect(snapRate(12.5, [18, 9, 0], 0.5)).toBeNull();
  });
});

describe("TVA — ventilation par taux", () => {
  const vat18 = entry("FA-1", [
    { accountId: "4111", debit: 1_180_000 },
    { accountId: "701", credit: 1_000_000 },
    { accountId: "4431", credit: 180_000 },
  ]);
  const vat9 = entry("FA-2", [
    { accountId: "4111", debit: 327_000 },
    { accountId: "701", credit: 300_000, taxCode: "TVA9" },
    { accountId: "4431", credit: 27_000 },
  ]);
  const exo = entry("FA-3", [
    { accountId: "4111", debit: 500_000 },
    { accountId: "701", credit: 500_000 },
  ]);
  const purchase = entry("FF-1", [
    { accountId: "601", debit: 400_000 },
    { accountId: "4451", debit: 72_000 },
    { accountId: "4011", credit: 472_000 },
  ]);

  it("ventile 18 %, 9 % et exonéré dans trois tranches distinctes", () => {
    const v = ventilateVat([vat18, vat9, exo], accounts);
    expect(v.bands.map((b) => b.rate)).toEqual([18, 9, 0]);
    expect(v.bands[0].base).toBe(1_000_000);
    expect(v.bands[0].vat).toBe(180_000);
    expect(v.bands[1].base).toBe(300_000);
    expect(v.bands[1].vat).toBe(27_000);
    expect(v.bands[2].base).toBe(500_000);
    expect(v.totals.base).toBe(1_800_000);
    expect(v.totals.collectee).toBe(207_000);
    expect(v.totals.ecart).toBe(0);
  });

  it("privilégie le code taxe sur le taux déduit", () => {
    const v = ventilateVat([vat9], accounts);
    const band = v.bands.find((b) => b.rate === 9)!;
    expect(band.inferred).toBe(0);
    expect(v.controls.find((c) => c.id === "inference")?.level).toBe("ok");
  });

  it("signale les taux déduits faute de code", () => {
    const v = ventilateVat([vat18], accounts);
    expect(v.bands[0].inferred).toBe(1);
    expect(v.controls.find((c) => c.id === "inference")?.level).toBe("warning");
  });

  it("traite une vente sans TVA comme exonérée et le dit", () => {
    const v = ventilateVat([exo], accounts);
    expect(v.bands.find((b) => b.rate === 0)?.base).toBe(500_000);
    expect(v.controls.find((c) => c.id === "sansTva")?.detail).toContain("FA-3");
  });

  it("isole un taux hors grille au lieu de le perdre", () => {
    const odd = entry("FA-4", [
      { accountId: "701", credit: 100_000 },
      { accountId: "4431", credit: 12_500 },
    ]);
    const v = ventilateVat([odd], accounts);
    expect(v.controls.find((c) => c.id === "horsGrille")?.level).toBe("warning");
    expect(v.totals.base).toBe(100_000);
    expect(v.totals.collectee).toBe(12_500);
  });

  it("signale un code taxe inconnu", () => {
    const weird = entry("FA-5", [
      { accountId: "701", credit: 100_000, taxCode: "TVA_BIDON" },
      { accountId: "4431", credit: 18_000 },
    ]);
    const v = ventilateVat([weird], accounts);
    const c = v.controls.find((x) => x.id === "codes")!;
    expect(c.level).toBe("warning");
    expect(c.detail).toContain("TVA_BIDON");
  });

  it("signale une facture qui mélange deux taux", () => {
    const mixed = entry("FA-6", [
      { accountId: "701", credit: 100_000, taxCode: "TVA18" },
      { accountId: "701", credit: 50_000, taxCode: "TVA9" },
      { accountId: "4431", credit: 22_500 },
    ]);
    const v = ventilateVat([mixed], accounts);
    expect(v.controls.find((c) => c.id === "mixte")?.level).toBe("warning");
  });

  it("ventile la TVA déductible et isole les immobilisations", () => {
    const v = ventilateVat([purchase], accounts);
    expect(v.totals.deductible).toBe(72_000);
    expect(v.totals.deductibleImmo).toBe(72_000);
  });

  it("exclut les brouillons du périmètre déclaratif", () => {
    const v = ventilateVat([vat18, entry("FA-7", [{ accountId: "701", credit: 9_999_999 }], "draft")], accounts);
    expect(v.totals.base).toBe(1_000_000);
  });

  it("calcule un net cohérent et ne produit jamais de blocage sur la ventilation", () => {
    const v = ventilateVat([vat18, vat9, exo, purchase], accounts);
    expect(v.totals.net).toBe(round(v.totals.collectee - 72_000));
    expect(v.blockingCount).toBe(0);
  });
});

const round = (n: number) => Math.round(n * 100) / 100;
