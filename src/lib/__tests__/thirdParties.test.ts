/**
 * P14 — Les lignes de tiers sans auxiliaire doivent pouvoir être complétées.
 * Le FEC les comptait (62 sur 67 dans le seed) ; aucune action ne permettait de
 * les corriger : le contrôle était vrai et inutile.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  isThirdPartyAccount, expectedTierType, collectiveOf,
  missingThirdPartyLines, groupMissingTiers, tiersForAccount, describeAssignment,
} from "../thirdParties";
import { assignThirdPartyToAccount, assignThirdPartyToLine } from "../actions";
import { seedDatabase } from "../seed";
import { getDB, resetDB } from "../store";
import type { ThirdParty } from "../types";

const tier = (o: Partial<ThirdParty>): ThirdParty => ({
  id: "t", organizationId: "o", companyId: "c", code: "X", collective: "401", type: "supplier",
  name: "T", createdAt: "", ...o,
} as ThirdParty);

describe("Tiers — lecture des comptes", () => {
  it("reconnaît les comptes de tiers et leur nature attendue", () => {
    expect(isThirdPartyAccount("4011")).toBe(true);
    expect(isThirdPartyAccount("411")).toBe(true);
    expect(isThirdPartyAccount("5211")).toBe(false);
    expect(isThirdPartyAccount("701")).toBe(false);
    expect(expectedTierType("4011")).toBe("supplier");
    expect(expectedTierType("4112")).toBe("customer");
    expect(expectedTierType("601")).toBeNull();
  });

  it("regroupe sur le collectif à trois chiffres", () => {
    expect(collectiveOf("4011")).toBe("401");
    expect(collectiveOf("4112")).toBe("411");
  });
});

describe("Tiers — lignes à compléter sur le seed", () => {
  const db = seedDatabase();
  const cid = db.companies[0].id;
  const entries = db.entries.filter((e) => e.companyId === cid);
  const missing = missingThirdPartyLines(entries, cid);

  it("compte 62 lignes sans auxiliaire, sur 67 lignes de tiers", () => {
    expect(missing).toHaveLength(62);
    const withTier = entries.flatMap((e) => e.lines).filter((l) => /^(40|41)/.test(l.accountId));
    expect(withTier.length).toBe(67);
  });

  it("regroupe 38 lignes fournisseurs et 24 lignes clients", () => {
    const groups = groupMissingTiers(missing);
    expect(groups.map((g) => [g.accountId, g.lines.length])).toEqual([["4011", 38], ["4111", 24]]);
    expect(groups[0].expectedType).toBe("supplier");
    expect(groups[1].expectedType).toBe("customer");
    expect(groups[0].totalAmount).toBe(11_157_286);
    expect(groups[1].totalAmount).toBe(37_704_751);
  });

  it("ne retient pas les lignes nulles ni les lignes déjà rattachées", () => {
    const sample = [
      { id: "e1", companyId: "c", number: "AC-1", date: "2026-01-05", label: "Vente",
        lines: [{ accountId: "4111", debit: 0, credit: 0, label: "" }, { accountId: "4111", debit: 1000, credit: 0, label: "Client" }] },
    ] as never as Parameters<typeof missingThirdPartyLines>[0];
    expect(missingThirdPartyLines(sample, "c")).toHaveLength(1);
  });

  it("trie dans l'ordre chronologique", () => {
    const dates = missing.map((l) => l.date);
    expect([...dates].sort()).toEqual(dates);
  });
});

describe("Tiers — propositions", () => {
  it("place d'abord le tiers du bon collectif", () => {
    const list = [
      tier({ id: "a", code: "CLI", collective: "411", type: "customer", name: "Alpha" }),
      tier({ id: "b", code: "FOU", collective: "401", type: "supplier", name: "Zêta" }),
      tier({ id: "c", code: "DIV", collective: "4011", type: "supplier", name: "Bêta" }),
    ];
    expect(tiersForAccount(list, "4011")[0].id).toBe("c");
    expect(tiersForAccount(list, "4111")[0].id).toBe("a");
  });

  it("décrit l'affectation avant de l'exécuter", () => {
    const group = { accountId: "4011", collective: "401", expectedType: "supplier" as const, lines: [1, 2, 3].map(() => ({ entryId: "e", entryNumber: "n", date: "", accountId: "4011", lineIndex: 0, label: "", amount: 1 })), totalAmount: 3 };
    expect(describeAssignment(group, tier({ code: "FOU001", name: "MatInfo" }))).toContain("3 lignes du compte 4011");
  });
});

describe("Tiers — affectation tracée", () => {
  // `seedDatabase()` fabrique un état neuf ; `resetDB()` remet **le store** à neuf.
  // Sans cela, l'affectation d'un test précédent restait dans l'état courant.
  beforeEach(() => {
    resetDB();
  });

  it("rattache une ligne et l'inscrit au journal d'audit", async () => {
    const db = getDB();
    const cid = db.companies[0].id;
    const target = missingThirdPartyLines(db.entries, cid)[0];
    const r = assignThirdPartyToLine(target.entryId, target.lineIndex, "tier-fourn-1");
    expect(r.ok).toBe(true);
    await new Promise((res) => setTimeout(res, 150));
    const after = getDB();
    const line = after.entries.find((e) => e.id === target.entryId)!.lines[target.lineIndex];
    expect(line.thirdPartyId).toBe("tier-fourn-1");
    expect(after.auditLogs[0].action).toBe("AFFECT_TIER");
    expect(after.auditLogs[0].after).toContain("Tiers FOU001 affecté");
  });

  it("rattache en masse toutes les lignes d'un compte, sans toucher aux autres", async () => {
    const cid = getDB().companies[0].id;
    const r = assignThirdPartyToAccount(cid, "4011", "tier-fourn-1");
    expect(r.ok).toBe(true);
    expect(r.count).toBe(38);
    await new Promise((res) => setTimeout(res, 150));
    const remaining = missingThirdPartyLines(getDB().entries, cid);
    expect(remaining.every((l) => l.accountId !== "4011")).toBe(true);
    expect(remaining).toHaveLength(24); // les lignes clients n'ont pas bougé
  });

  it("ne réaffecte jamais silencieusement une ligne déjà rattachée", async () => {
    const cid = getDB().companies[0].id;
    assignThirdPartyToAccount(cid, "4011", "tier-fourn-1");
    await new Promise((res) => setTimeout(res, 150));
    const second = assignThirdPartyToAccount(cid, "4011", "tier-fourn-2");
    expect(second.count).toBe(0);
  });

  it("refuse un tiers d'une autre société, un compte non-tiers et une société inconnue", () => {
    const cid = getDB().companies[0].id;
    const otherCompany = getDB().companies[1].id;
    const otherTier = getDB().tiers.find((t) => t.companyId === otherCompany);
    if (otherTier) {
      expect(assignThirdPartyToAccount(cid, "4011", otherTier.id).ok).toBe(false);
    }
    expect(assignThirdPartyToAccount(cid, "5211", "tier-fourn-1").ok).toBe(false);
    expect(assignThirdPartyToAccount(cid, "4011", "tier-inexistant").ok).toBe(false);
    expect(assignThirdPartyToLine("entree-inexistante", 0, "tier-fourn-1").ok).toBe(false);
  });
});
