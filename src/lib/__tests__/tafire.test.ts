import { describe, it, expect } from "vitest";
import { buildTafire, workingCapital, balanceOf, tafireLines } from "../tafire";
import type { BalanceRow } from "../liasse";

const row = (code: string, debit = 0, credit = 0, label = code): BalanceRow => ({ code, label, debit, credit });

/** Applique une écriture équilibrée à une balance (crée la ligne si besoin). */
function move(rows: BalanceRow[], debitCode: string, creditCode: string, amount: number): BalanceRow[] {
  const next = rows.map((r) => ({ ...r }));
  const add = (code: string, d: number, c: number) => {
    const found = next.find((r) => r.code === code);
    if (found) {
      found.debit += d;
      found.credit += c;
    } else {
      next.push(row(code, d, c));
    }
  };
  add(debitCode, amount, 0);
  add(creditCode, 0, amount);
  return next;
}

// Balance d'ouverture (N-1) — équilibrée : 2 200 000 de chaque côté.
const opening: BalanceRow[] = [
  row("2411", 1_000_000, 0), row("2811", 0, 200_000),
  row("311", 300_000, 0), row("411", 400_000, 0),
  row("521", 500_000, 0),
  row("101", 0, 1_000_000), row("161", 0, 600_000), row("401", 0, 400_000),
];

/** Exercice N : ventes, achats, règlements, investissement, dotation, remboursement. */
function closingOf(): BalanceRow[] {
  let rows = opening.map((r) => ({ ...r }));
  rows = move(rows, "521", "701", 1_000_000); // vente comptant
  rows = move(rows, "601", "401", 400_000); // achat à crédit
  rows = move(rows, "401", "521", 250_000); // règlement fournisseur
  rows = move(rows, "521", "411", 300_000); // encaissement client
  rows = move(rows, "2411", "521", 500_000); // acquisition d'immobilisation au comptant
  rows = move(rows, "681", "2811", 150_000); // dotation aux amortissements
  rows = move(rows, "161", "521", 100_000); // remboursement d'emprunt
  return rows;
}

describe("TAFIRE — agrégats", () => {
  it("calcule un solde net par préfixe", () => {
    expect(balanceOf(opening, ["52"])).toBe(500_000);
    expect(balanceOf(opening, ["101"])).toBe(-1_000_000);
  });

  it("ventile le BFR par le sens du solde, sans double compte", () => {
    const wc = workingCapital([
      row("311", 300_000),
      row("411", 400_000),
      row("419", 0, 50_000), // client créditeur → dette
      row("401", 0, 400_000),
    ]);
    expect(wc.stocks).toBe(300_000);
    expect(wc.creances).toBe(400_000);
    expect(wc.dettes).toBe(450_000);
    expect(wc.bfr).toBe(250_000);
  });
});

describe("TAFIRE — construction", () => {
  const closing = closingOf();
  const t = buildTafire(opening, closing);

  it("boucle au franc près sur un exercice cohérent", () => {
    expect(t.available).toBe(true);
    expect(t.ecart).toBe(0);
    expect(t.blockingCount).toBe(0);
    expect(t.tresorerieOuverture).toBe(500_000);
    expect(t.tresorerieCloture).toBe(950_000);
    expect(t.tresorerieCalculee).toBe(950_000);
  });

  it("calcule la CAFG (résultat + dotations)", () => {
    expect(t.cafg).toBe(600_000); // 450 000 de résultat + 150 000 de dotations
    expect(t.zones[0].fluxes[0].amount).toBe(600_000);
  });

  it("traite la variation du BFR dans le bon sens", () => {
    expect(t.variationBfr).toBe(-450_000); // BFR 300 000 → −150 000
    expect(t.zones[0].fluxes[1].amount).toBe(450_000); // une libération de BFR rentre de la trésorerie
    expect(t.zones[0].total).toBe(1_050_000);
  });

  it("déduit l'investissement de la variation des immobilisations brutes", () => {
    expect(t.zones[1].total).toBe(-500_000);
    expect(t.zones[1].fluxes[0].basis).toContain("1000000");
  });

  it("isole les financements (capital et emprunts)", () => {
    expect(t.zones[2].total).toBe(-100_000);
    expect(t.zones[2].fluxes[0].amount).toBe(0);
    expect(t.zones[2].fluxes[1].amount).toBe(-100_000);
  });

  it("produit un contrôle de bouclage positif et un avertissement sur les cessions", () => {
    expect(t.controls.find((c) => c.id === "bouclage")?.level).toBe("ok");
    expect(t.controls.find((c) => c.id === "immo")?.level).toBe("warning");
  });

  it("détecte un flux manquant (bouclage cassé)", () => {
    const broken = closing.map((r) => (r.code === "521" ? { ...r, debit: r.debit + 100_000 } : r));
    const bad = buildTafire(opening, broken);
    expect(bad.ecart).toBe(-100_000);
    expect(bad.blockingCount).toBe(1);
    expect(bad.controls.find((c) => c.id === "bouclage")?.detail).toContain("100000");
  });

  it("reste lisible dans le document imprimé", () => {
    const lines = tafireLines(t);
    expect(lines[0]).toMatchObject({ label: "Trésorerie d'ouverture", amount: 500_000 });
    expect(lines[lines.length - 1]).toMatchObject({ amount: 950_000 });
  });
});

describe("TAFIRE — balance d'ouverture absente", () => {
  it("refuse de calculer plutôt que de supposer des zéros", () => {
    const t = buildTafire(null, closingOf());
    expect(t.available).toBe(false);
    expect(t.reason).toContain("Balance N-1");
    expect(t.tresorerieCloture).toBe(950_000);
    expect(t.blockingCount).toBe(1);
    expect(tafireLines(t)[0].label).toContain("non calculable");
  });
});
