/**
 * P0-4 — Recette de l'import de balance.
 *
 * Le défaut corrigé n'était pas un calcul faux mais un SILENCE : un fichier
 * réel (en-têtes métier, séparateurs de milliers, colonne unique de solde)
 * produisait 0 ligne sans un mot, donc un bilan vide indistinguable d'un
 * dossier sans activité.
 */
import { describe, it, expect } from "vitest";
import { parseBalanceText, parseBalanceGrid, parseAmount, normalizeHeader, parseDelimited } from "../balanceImport";
import { buildStatements } from "../liasse";

describe("import > en-têtes réels", () => {
  it("reconnaît la forme canonique Compte / Libellé / Débit / Crédit", () => {
    const r = parseBalanceText(
      ["Compte;Libellé;Débit;Crédit", "101;Capital;0;5 000 000", "521;Banque;5 000 000;0"].join("\n"),
    );
    expect(r.ok).toBe(true);
    expect(r.rows).toEqual([
      { code: "101", label: "Capital", debit: 0, credit: 5_000_000 },
      { code: "521", label: "Banque", debit: 5_000_000, credit: 0 },
    ]);
    expect(r.totals.ecart).toBe(0);
  });

  it("reconnaît les variantes métier : « N° de compte », « Intitulé », « Mouvement débit »", () => {
    const r = parseBalanceText(
      ["N° de compte;Intitulé;Mouvement débit;Mouvement crédit", "411;Clients;1 000 000;0", "701;Ventes;0;1 000 000"].join("\n"),
    );
    expect(r.ok).toBe(true);
    expect(r.headerRow).toBe(0);
    expect(r.rows.length).toBe(2);
    expect(r.signals.join(" ")).toContain("En-têtes reconnus");
  });

  it("accepte la virgule décimale, les espaces insécables et les parenthèses négatives", () => {
    expect(parseAmount("1 234 567,89")).toBe(1234567.89);
    expect(parseAmount("1.234.567")).toBe(1234567);
    expect(parseAmount("(1 000)")).toBe(-1000);
    expect(parseAmount("2 500-")).toBe(-2500);
    expect(parseAmount("12 000 FCFA")).toBe(12000);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("n/a")).toBeNull();
  });

  it("ne casse pas sur un libellé contenant le séparateur, entre guillemets", () => {
    const grid = parseDelimited('Compte,Libellé,Débit,Crédit\n601,"Achats, marchandises",100 000,0\n');
    expect(grid[1][1]).toBe("Achats, marchandises");
    const r = parseBalanceGrid(grid);
    expect(r.ok).toBe(true);
    expect(r.rows[0].label).toBe("Achats, marchandises");
  });

  it("normalise les en-têtes accentués et ponctués", () => {
    expect(normalizeHeader("N° de Compte")).toBe("ndecompte");
    expect(normalizeHeader("Débit")).toBe("debit");
    expect(normalizeHeader("  Libellé  ")).toBe("libelle");
  });
});

describe("import > détection par le contenu", () => {
  it("déduit les colonnes quand aucun en-tête n'existe", () => {
    const r = parseBalanceText(["101;Capital;0;5000000", "521;Banque;5000000;0"].join("\n"));
    expect(r.ok).toBe(true);
    expect(r.headerRow).toBeNull();
    expect(r.rows.length).toBe(2);
    expect(r.signals.join(" ")).toContain("détectée par le contenu");
  });

  it("interprète une colonne unique de solde signé, et le dit", () => {
    const r = parseBalanceText(["101;Capital;-5000000", "521;Banque;5000000"].join("\n"));
    expect(r.ok).toBe(true);
    expect(r.rows.find((x) => x.code === "101")).toMatchObject({ debit: 0, credit: 5_000_000 });
    expect(r.rows.find((x) => x.code === "521")).toMatchObject({ debit: 5_000_000, credit: 0 });
    expect(r.warnings.join(" ")).toContain("Solde signé");
  });

  it("cumule deux lignes du même compte au lieu d'écraser en silence", () => {
    const r = parseBalanceText(["Compte;Libellé;Débit;Crédit", "411;Client A;100;0", "411;Client B;50;0"].join("\n"));
    expect(r.rows.length).toBe(1);
    expect(r.rows[0].debit).toBe(150);
    expect(r.signals.join(" ")).toContain("cumulés");
  });
});

describe("import > refus explicite, jamais muet", () => {
  it("un fichier sans compte est REFUSÉ avec un motif lisible", () => {
    const r = parseBalanceText(
      ["Rapport de gestion", "Chiffre d'affaires;20000000", "Résultat;1500000"].join("\n"),
    );
    expect(r.ok).toBe(false);
    expect(r.rows).toEqual([]);
    expect(r.errors.join(" ")).toMatch(/Aucun compte exploitable|numéro de compte/);
  });

  it("un fichier vide est refusé en le disant", () => {
    const r = parseBalanceText("");
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain("aucune ligne exploitable");
  });

  it("les lignes inexploitables sont listées, pas perdues", () => {
    const r = parseBalanceText(
      ["Compte;Libellé;Débit;Crédit", "ABC;Compte invalide;100;0", "101;Capital;0;100"].join("\n"),
    );
    expect(r.ok).toBe(true);
    expect(r.rejected.length).toBe(1);
    expect(r.rejected[0].reason).toContain("non numérique");
    expect(r.warnings.join(" ")).toContain("écartée");
  });

  it("une balance déséquilibrée est acceptée mais signalée avec le montant exact", () => {
    const r = parseBalanceText(["Compte;Libellé;Débit;Crédit", "101;Capital;0;1000", "521;Banque;900;0"].join("\n"));
    expect(r.ok).toBe(true);
    expect(r.totals.ecart).toBe(-100);
    expect(r.warnings.join(" ")).toContain("-100");
  });

  it("les lignes de total ne sont pas prises pour des comptes", () => {
    const r = parseBalanceText(
      ["Compte;Libellé;Débit;Crédit", "101;Capital;0;1000", "521;Banque;1000;0", "TOTAL;;1000;1000"].join("\n"),
    );
    expect(r.rows.length).toBe(2);
    expect(r.rejected.length).toBe(0);
  });
});

describe("import > intégration avec le moteur d'états", () => {
  it("une balance importée depuis un CSV produit un bilan équilibré", () => {
    const csv = [
      "N° de compte;Intitulé;Débit;Crédit",
      "101;Capital social;0;7 300 000",
      "2411;Matériel industriel;5 000 000;0",
      "2841;Amortissements;0;1 000 000",
      "311;Marchandises;2 000 000;0",
      "411;Clients;3 000 000;0",
      "521;Banque;4 000 000;0",
      "401;Fournisseurs;0;2 000 000",
      "4431;TVA facturée;0;500 000",
      "4452;TVA récupérable;200 000;0",
      "421;Personnel;0;300 000",
      "4311;CNSS;0;100 000",
      "601;Achats;6 000 000;0",
      "661;Personnel;1 000 000;0",
      "701;Ventes;0;10 000 000",
    ].join("\n");

    const r = parseBalanceText(csv);
    expect(r.ok).toBe(true);
    expect(r.totals.ecart).toBe(0);
    expect(r.rows.length).toBe(14);

    const st = buildStatements(r.rows);
    expect(st.bilan.actifTotal).toBe(13_200_000);
    expect(st.bilan.passifTotal).toBe(13_200_000);
  });
});
