/**
 * P12 — La base fiscale et le Dashboard ignoraient la classe 8 (opérations hors
 * activités ordinaires), alors que la liasse l'inclut dans le résultat net.
 * Trois écrans pour le même dossier : −587 805 (Fiscalité/Dashboard) contre
 * −479 805 (liasse). Écart constaté : 108 000 FCFA.
 */
import { describe, it, expect } from "vitest";
import { fiscalBaseFromMoves } from "../fiscalite";
import { financialSummary } from "../accounting";
import { movementsByAccount } from "../accounting";
import { buildStatements } from "../liasse";
import { seedDatabase } from "../seed";

const moves = (rows: [string, number, number][]) =>
  new Map(rows.map(([code, debit, credit]) => [code, { debit, credit }]));

describe("Classe 8 — le résultat net inclut les opérations HAO", () => {
  it("classe un solde créditeur en produit et un solde débiteur en charge", () => {
    const b = fiscalBaseFromMoves(moves([
      ["701", 0, 1_000_000], // ventes
      ["601", 600_000, 0], // achats
      ["812", 0, 50_000], // produit HAO
      ["811", 20_000, 0], // charge HAO
    ]));
    expect(b.chiffreAffaires).toBe(1_000_000); // le CA reste strict (70x)
    expect(b.produits).toBe(1_050_000);
    expect(b.charges).toBe(620_000);
    expect(b.resultatComptable).toBe(430_000);
  });

  it("ne gonfle pas les produits d'une charge HAO", () => {
    const b = fiscalBaseFromMoves(moves([["811", 300_000, 0]]));
    expect(b.produits).toBe(0);
    expect(b.charges).toBe(300_000);
    expect(b.resultatComptable).toBe(-300_000);
  });
});

describe("Classe 8 — cohérence des trois écrans sur le dossier de démonstration", () => {
  const db = seedDatabase();
  const entries = db.entries.filter((e) => e.companyId === db.companies[0].id);
  const table = [...movementsByAccount(entries)].map(([code, m]) => ({ code, label: "", debit: m.debit, credit: m.credit }));

  it("la base fiscale égale le résultat de la liasse", () => {
    const base = fiscalBaseFromMoves(movementsByAccount(entries));
    const liasse = buildStatements(table).result;
    expect(base.resultatComptable).toBe(-479_805);
    expect(base.resultatComptable).toBe(liasse.resultat);
  });

  it("le Dashboard affiche le même résultat et garde le CA strict", () => {
    const sum = financialSummary(entries);
    expect(sum.resultat).toBe(-479_805);
    expect(sum.ca).toBe(20_190_000);
    expect(sum.produits).toBe(20_640_000);
    expect(sum.charges).toBe(21_119_805);
  });
});
