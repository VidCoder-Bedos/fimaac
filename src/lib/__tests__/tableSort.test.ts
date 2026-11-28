/**
 * P30 — Tri des tableaux : accessible, stable, prévisible.
 *
 * Avant : aucune table du produit ne se triait au clavier ni n'exposait son état
 * de tri (`aria-sort`). Sur une balance de plusieurs centaines de lignes, il
 * fallait trier « à l'œil » — ou exporter dans un tableur.
 */
import { describe, it, expect } from "vitest";
import { sortRows, toggleSort, ariaSort, compareValues } from "../tableSort";

const rows = [
  { code: "4111", label: "Clients", amount: "15 167 298" },
  { code: "601", label: "Achats", amount: "9 000 000" },
  { code: "", label: "Sans compte", amount: "" },
  { code: "4011", label: "fournisseurs", amount: "11 157 286" },
  { code: "445", label: "État, TVA", amount: "2 473 332" },
];

const byCode = (r: { code: string }) => r.code;
const valueOf = (row: (typeof rows)[number], key: string) => (row as unknown as Record<string, unknown>)[key];

describe("Bascule de tri", () => {
  it("croissant → décroissant → ordre d'origine", () => {
    const first = toggleSort(null, "amount");
    expect(first).toEqual({ key: "amount", direction: "asc" });
    const second = toggleSort(first, "amount");
    expect(second).toEqual({ key: "amount", direction: "desc" });
    expect(toggleSort(second, "amount")).toBeNull();
  });

  it("changer de colonne repart en croissant", () => {
    expect(toggleSort({ key: "amount", direction: "desc" }, "label")).toEqual({ key: "label", direction: "asc" });
  });

  it("l'état exposé aux lecteurs d'écran correspond au tri réel", () => {
    const state = { key: "code", direction: "asc" as const };
    expect(ariaSort(state, "code")).toBe("ascending");
    expect(ariaSort({ ...state, direction: "desc" }, "code")).toBe("descending");
    expect(ariaSort(state, "label")).toBe("none");
    expect(ariaSort(null, "code")).toBe("none");
  });
});

describe("Comparaison", () => {
  it("les textes se comparent comme un humain français les lit (accents, casse)", () => {
    expect(compareValues("Écritures", "etat")).toBeLessThan(0);
    expect(compareValues("fournisseurs", "Fournisseurs")).toBe(0);
    expect(compareValues("compte 10", "compte 9")).toBeGreaterThan(0);
  });

  it("les montants saisis en texte se comparent comme des nombres", () => {
    expect(compareValues("15 167 298", "9 000 000")).toBeGreaterThan(0);
    expect(compareValues("1 234,5", "1 234,05")).toBeGreaterThan(0);
  });

  it("une valeur vide est plus petite que tout, mais traitée à part", () => {
    expect(compareValues("", "a")).toBe(1);
    expect(compareValues("a", "")).toBe(-1);
    expect(compareValues("", "")).toBe(0);
  });
});

describe("Tri des lignes", () => {
  it("aucun état de tri = ordre d'origine, sans copie partagée", () => {
    const out = sortRows(rows, null, valueOf);
    expect(out).toEqual(rows);
    expect(out).not.toBe(rows);
  });

  it("croissant sur les montants, vides en fin", () => {
    const out = sortRows(rows, { key: "amount", direction: "asc" }, valueOf);
    expect(out.map(byCode)).toEqual(["445", "601", "4011", "4111", ""]);
  });

  it("décroissant sur les montants, vides toujours en fin", () => {
    const out = sortRows(rows, { key: "amount", direction: "desc" }, valueOf);
    expect(out.map(byCode)).toEqual(["4111", "4011", "601", "445", ""]);
  });

  it("tri alphabétique insensible à la casse, accents compris", () => {
    const out = sortRows(rows, { key: "label", direction: "asc" }, valueOf);
    expect(out.map((r) => r.label)).toEqual(["Achats", "Clients", "État, TVA", "fournisseurs", "Sans compte"]);
  });

  it("le tri est stable : les ex æquo gardent leur ordre d'origine", () => {
    const ties = [
      { id: 1, group: "A" }, { id: 2, group: "B" }, { id: 3, group: "A" }, { id: 4, group: "B" },
    ];
    const out = sortRows(ties, { key: "group", direction: "asc" }, (r, k) => (r as unknown as Record<string, unknown>)[k]);
    expect(out.map((r) => r.id)).toEqual([1, 3, 2, 4]);
  });

  it("ne modifie jamais le tableau d'entrée", () => {
    const original = rows.map(byCode);
    sortRows(rows, { key: "amount", direction: "desc" }, valueOf);
    expect(rows.map(byCode)).toEqual(original);
  });
});
