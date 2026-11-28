import { describe, it, expect } from "vitest";
import { buildFec, fecAmount, fecDate, fecFileName, FEC_COLUMNS } from "../fec";
import type { Account, JournalEntry, ThirdParty } from "../types";

const accounts = [
  { code: "411", label: "Clients", postable: true } as unknown as Account,
  { code: "701", label: "Ventes", postable: true } as unknown as Account,
  { code: "401", label: "Fournisseurs", postable: true } as unknown as Account,
  { code: "601", label: "Achats", postable: true } as unknown as Account,
];
const journals = [
  { id: "j1", code: "VE", type: "sales" },
  { id: "j2", code: "AC", type: "purchases" },
];
const tiers = [
  { id: "t1", code: "CL001", name: "SOGEDIS", type: "customer" } as unknown as ThirdParty,
];

const line = (o: Partial<JournalEntry["lines"][number]>) =>
  ({ accountId: "411", debit: 0, credit: 0, label: "", taxCode: "", thirdPartyId: "", analytic: "", ...o }) as unknown as JournalEntry["lines"][number];

const entry = (o: Partial<JournalEntry>): JournalEntry =>
  ({
    id: "e1",
    number: "VE-001",
    journalId: "j1",
    companyId: "c1",
    date: "2026-03-05",
    label: "Facture",
    reference: "F-2026-001",
    status: "validated",
    updatedAt: "2026-03-06T10:00:00.000Z",
    lines: [
      line({ accountId: "411", debit: 118000, thirdPartyId: "t1" }),
      line({ accountId: "701", credit: 118000 }),
    ],
    ...o,
  }) as unknown as JournalEntry;

describe("FEC — format", () => {
  it("écrit les montants avec un point décimal et deux décimales", () => {
    expect(fecAmount(1234.5)).toBe("1234.50");
    expect(fecAmount(0)).toBe("0.00");
    expect(fecAmount(-42.129)).toBe("42.13");
    expect(fecAmount(Number.NaN)).toBe("0.00");
    expect(fecAmount(1234.5)).not.toContain(",");
  });

  it("formate les dates en AAAAMMJJ et vide les dates invalides", () => {
    expect(fecDate("2026-03-05")).toBe("20260305");
    expect(fecDate("2026-03-05T10:00:00Z")).toBe("20260305");
    expect(fecDate("")).toBe("");
    expect(fecDate("05/03/2026")).toBe("");
  });

  it("nomme le fichier selon la convention FEC", () => {
    expect(fecFileName("FIMAAC SARL", new Date("2026-12-31T00:00:00Z"))).toBe("FEC_20261231_FIMAAC_SARL.txt");
  });
});

describe("FEC — construction", () => {
  it("produit les 18 colonnes de référence dans l'ordre", () => {
    expect(FEC_COLUMNS).toHaveLength(18);
    const r = buildFec([entry({})], journals, accounts, tiers);
    expect(r.header).toEqual([...FEC_COLUMNS]);
    expect(r.rows[0]).toHaveLength(18);
    expect(r.content.split("\n")[0]).toBe(FEC_COLUMNS.join("|"));
    expect(r.content.split("\n")).toHaveLength(3);
  });

  it("exclut les brouillons et compte les lignes exportées", () => {
    const r = buildFec([entry({}), entry({ id: "e2", number: "VE-002", status: "draft" })], journals, accounts, tiers);
    expect(r.entryCount).toBe(1);
    expect(r.lineCount).toBe(2);
    expect(r.content).not.toContain("draft");
  });

  it("remplit CompAuxNum / CompAuxLib à partir du tiers de la ligne", () => {
    const r = buildFec([entry({})], journals, accounts, tiers);
    const debit = r.rows[0];
    expect(debit[6]).toBe("CL001");
    expect(debit[7]).toBe("SOGEDIS");
    expect(r.rows[1][6]).toBe("");
  });

  it("renseigne les libellés de journal, la devise et la date de validation", () => {
    const r = buildFec([entry({})], journals, accounts, tiers);
    expect(r.rows[0][0]).toBe("VE");
    expect(r.rows[0][1]).toBe("Journal des ventes");
    expect(r.rows[0][17]).toBe("XOF");
    expect(r.rows[0][15]).toBe("20260306");
    expect(r.rows[0][8]).toBe("F-2026-001");
  });

  it("trie chronologiquement et équilibre les totaux", () => {
    const r = buildFec(
      [entry({ id: "b", number: "VE-002", date: "2026-04-01" }), entry({ id: "a", number: "VE-001", date: "2026-02-01" })],
      journals, accounts, tiers,
    );
    expect(r.rows[0][4]).toBe("411");
    expect(r.rows[0][3]).toBe("20260201");
    expect(r.totals.debit).toBe(236000);
    expect(r.totals.credit).toBe(236000);
    expect(r.totals.ecart).toBe(0);
  });

  it("signale une écriture déséquilibrée comme bloquante", () => {
    const r = buildFec([entry({ lines: [line({ accountId: "411", debit: 100 }), line({ accountId: "701", credit: 90 })] })], journals, accounts, tiers);
    expect(r.blockingCount).toBe(2);
    expect(r.controls.find((c) => c.id === "ecritures")?.level).toBe("blocking");
    expect(r.controls.find((c) => c.id === "equilibre")?.level).toBe("blocking");
  });

  it("signale les doublons de numéro de pièce en avertissement", () => {
    const r = buildFec([entry({ id: "a" }), entry({ id: "b" })], journals, accounts, tiers);
    expect(r.controls.find((c) => c.id === "doublons")?.level).toBe("warning");
    expect(r.controls.find((c) => c.id === "numerotation")?.level).toBe("ok");
  });

  it("neutralise les séparateurs de colonnes dans les libellés", () => {
    const r = buildFec([entry({ reference: "F|2026\n001" })], journals, accounts, tiers);
    expect(r.rows[0][8]).toBe("F 2026 001");
    expect(r.rows[0]).toHaveLength(18);
  });

  it("numérote les écritures en séquence continue par journal", () => {
    const r = buildFec([
      entry({ id: "a", number: "VE-019", date: "2026-02-01" }),
      entry({ id: "b", number: "ACH-777", journalId: "j2", date: "2026-02-02", lines: [line({ accountId: "601", debit: 500 }), line({ accountId: "401", credit: 500 })] }),
      entry({ id: "c", number: "VE-002", date: "2026-02-03" }),
    ], journals, accounts, tiers);
    expect(r.rows.map((row) => row[2])).toEqual(["VE-0001", "VE-0001", "AC-0001", "AC-0001", "VE-0002", "VE-0002"]);
    expect(r.rows[0][8]).toBe("F-2026-001");
    expect(r.controls.find((c) => c.id === "numerotation")?.level).toBe("ok");
  });

  it("utilise le libellé de ligne s'il apporte une information", () => {
    const r = buildFec([entry({ lines: [line({ accountId: "411", debit: 100, label: "Client X" }), line({ accountId: "701", credit: 100, label: "Ventes" })] })], journals, accounts, tiers);
    expect(r.rows[0][10]).toBe("Client X");
    expect(r.rows[1][10]).toBe("Facture");
  });

  it("annonce la période couverte et un fichier vide sans bloquant", () => {
    const empty = buildFec([], journals, accounts, tiers);
    expect(empty.rows).toHaveLength(0);
    expect(empty.blockingCount).toBe(0);
    expect(empty.content).toBe(FEC_COLUMNS.join("|"));
    const r = buildFec([entry({})], journals, accounts, tiers);
    expect(r.controls.find((c) => c.id === "periode")?.detail).toContain("20260305");
  });
});
