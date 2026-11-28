/**
 * P22 — Balance 6 colonnes : un seul lecteur, qui dit ce qu'il a lu.
 *
 * Avant : `parseBalance6` supposait en dur « SD N · SC N · SD N-1 · SC N-1 »
 * (une balance « Débit · Crédit · Solde débiteur · Solde créditeur » était donc
 * lue de travers), jetait en silence toute ligne au code non numérique et
 * renvoyait une balance **vide** quand il ne comprenait pas — indistinguable
 * d'un dossier sans activité.
 */
import { describe, it, expect } from "vitest";
import { parseBalance6Grid, parseAmount } from "../balance6";

const G = (rows: string[][]) => rows;

describe("Montants — formats rencontrés", () => {
  it("lit les écritures françaises, les milliers et les négatifs entre parenthèses", () => {
    expect(parseAmount("1 234 567").value).toBe(1_234_567);
    expect(parseAmount("1.234.567").value).toBe(1_234_567);
    expect(parseAmount("12 000,50").value).toBe(12_001);
    expect(parseAmount("1.234.567,89").value).toBe(1_234_568);
    expect(parseAmount("(12 000)").value).toBe(-12_000);
    expect(parseAmount("-3 000").value).toBe(-3_000);
    expect(parseAmount("500,00 D").value).toBe(500);
    expect(parseAmount("").value).toBe(0);
  });
});

describe("Disposition — soldes préférés aux mouvements", () => {
  it("une balance « Débit · Crédit · Solde débiteur · Solde créditeur » donne les SOLDES, pas les mouvements", () => {
    const res = parseBalance6Grid(G([
      ["Compte", "Libellé", "Débit", "Crédit", "Solde débiteur", "Solde créditeur"],
      ["601", "Achats", "9 000 000", "9 000 000", "0", "0"],
      ["4111", "Clients", "15 167 298", "0", "15 167 298", "0"],
      ["4011", "Fournisseurs", "0", "11 157 286", "0", "11 157 286"],
    ]));
    expect(res.ok).toBe(true);
    expect(res.layout).toBe("solde");
    const clients = res.n.find((r) => r.code === "4111")!;
    expect(clients.debit).toBe(15_167_298);
    expect(clients.credit).toBe(0);
    const achats = res.n.find((r) => r.code === "601")!;
    expect(achats.debit).toBe(0);
    expect(achats.credit).toBe(0);
  });

  it("reconnaît les soldes de deux exercices (N et N-1)", () => {
    const res = parseBalance6Grid(G([
      ["N° compte", "Intitulé", "Solde débiteur N", "Solde créditeur N", "Solde débiteur N-1", "Solde créditeur N-1"],
      ["4111", "Clients", "15 167 298", "0", "12 000 000", "0"],
    ]));
    expect(res.layout).toBe("solde");
    expect(res.n[0].debit).toBe(15_167_298);
    expect(res.n1[0].debit).toBe(12_000_000);
  });

  it("une colonne de solde signée décide du côté par son signe", () => {
    const res = parseBalance6Grid(G([
      ["Compte", "Libellé", "Solde"],
      ["4111", "Clients", "520 000"],
      ["4011", "Fournisseurs", "-774 000"],
    ]));
    expect(res.layout).toBe("solde");
    expect(res.n.find((r) => r.code === "4111")).toMatchObject({ debit: 520_000, credit: 0 });
    expect(res.n.find((r) => r.code === "4011")).toMatchObject({ debit: 0, credit: 774_000 });
  });

  it("une balance de mouvements est lue mais annoncée comme telle", () => {
    const res = parseBalance6Grid(G([
      ["Compte", "Libellé", "Mouvement débit", "Mouvement crédit"],
      ["601", "Achats", "3 000", "0"],
    ]));
    expect(res.layout).toBe("entetes");
    expect(res.warnings.join(" ")).toContain("mouvements");
  });
});

describe("Refus explicite", () => {
  it("un fichier vide le dit, au lieu de renvoyer une balance vide", () => {
    const res = parseBalance6Grid([]);
    expect(res.ok).toBe(false);
    expect(res.errors[0]).toContain("vide");
  });

  it("un fichier incompris le dit, avec la marche à suivre", () => {
    const res = parseBalance6Grid(G([["Bonjour"], ["Merci"]]));
    expect(res.ok).toBe(false);
    expect(res.errors[0]).toContain("Aucun compte lu");
  });

  it("repli positionnel : la supposition est annoncée, jamais silencieuse", () => {
    const res = parseBalance6Grid(G([
      ["4111", "Clients", "15 167 298", "0", "12 000 000", "0"],
      ["4011", "Fournisseurs", "0", "11 157 286", "0", "9 000 000"],
    ]));
    expect(res.ok).toBe(true);
    expect(res.layout).toBe("positionnel");
    expect(res.headerRow).toBeNull();
    expect(res.warnings[0]).toContain("disposition supposée");
    expect(res.n[0]).toMatchObject({ code: "4111", debit: 15_167_298 });
    expect(res.n1[0]).toMatchObject({ code: "4111", debit: 12_000_000 });
  });
});

describe("Lignes écartées — listées, jamais perdues", () => {
  it("donne le motif de chaque ligne écartée", () => {
    const res = parseBalance6Grid(G([
      ["Compte", "Libellé", "Débit", "Crédit"],
      ["4111", "Clients", "100", "0"],
      ["TOTAL CLASSE 4", "", "100", "0"],
      ["41", "Clients (collectif)", "", ""],
      ["ABC", "Ligne parasite", "5", "0"],
    ]));
    expect(res.n).toHaveLength(1);
    expect(res.subtotals).toHaveLength(1);
    expect(res.rejected).toEqual([
      expect.objectContaining({ reason: "aucun montant sur la ligne" }),
      expect.objectContaining({ reason: expect.stringContaining("non comptable") }),
    ]);
    expect(res.warnings.join(" ")).toContain("2 ligne(s) écartée(s)");
  });

  it("les totaux de la balance portent sur les lignes retenues, avec l'écart visible", () => {
    const res = parseBalance6Grid(G([
      ["Compte", "Libellé", "Débit", "Crédit"],
      ["4111", "Clients", "15 167 298", "0"],
      ["4011", "Fournisseurs", "0", "15 000 000"],
    ]));
    expect(res.totals.debitN).toBe(15_167_298);
    expect(res.totals.creditN).toBe(15_000_000);
    expect(res.totals.ecartN).toBe(167_298);
    expect(res.warnings.join(" ")).toContain("déséquilibrée");
  });

  it("compte les comptes dotés d'un solde N-1", () => {
    const res = parseBalance6Grid(G([
      ["Compte", "Libellé", "Solde débiteur N", "Solde créditeur N", "Solde débiteur N-1", "Solde créditeur N-1"],
      ["4111", "Clients", "100", "0", "50", "0"],
      ["4011", "Fournisseurs", "0", "100", "0", "0"],
    ]));
    expect(res.signals.join(" ")).toContain("1 avec un solde N-1");
  });
});
