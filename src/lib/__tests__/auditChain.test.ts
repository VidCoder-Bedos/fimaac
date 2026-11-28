/**
 * P2 — Recette du chaînage du journal d'audit.
 *
 * Le produit annonçait un « journal inviolable » sans aucun mécanisme. En
 * local, l'inviolabilité est impossible ; la DÉTECTION de l'altération, elle,
 * est atteignable. Ces tests vérifient les deux : que le scellement est juste
 * (SHA-256 conforme aux vecteurs officiels) et que toute manipulation de la
 * chaîne est repérée.
 */
import { describe, it, expect } from "vitest";
import { sha256, sealLog, verifyAuditChain, canonicalPayload, GENESIS_HASH } from "../auditChain";
import { seedDatabase } from "../seed";
import { runPayroll } from "../actions";
import { getDB } from "../store";
import type { AuditLog } from "../types";

const log = (over: Partial<AuditLog> = {}): AuditLog => ({
  id: over.id ?? "log-1",
  userId: "user-1",
  organizationId: "org-1",
  action: "CREATE_ENTRY",
  entity: "JournalEntry",
  entityId: "entry-1",
  before: null,
  after: "Écriture créée",
  ip: "127.0.0.1",
  createdAt: "2026-11-28T10:00:00.000Z",
  ...over,
});

/** Construit une chaîne scellée, du plus récent au plus ancien (ordre du store). */
const chain = (count: number): AuditLog[] => {
  const chronological: AuditLog[] = [];
  let previous: { seq: number; hash: string } | null = null;
  for (let i = 0; i < count; i++) {
    const sealed = sealLog(log({ id: `log-${i}`, after: `Action ${i}`, createdAt: `2026-11-28T10:0${i}:00.000Z` }), previous);
    chronological.push(sealed);
    previous = { seq: sealed.seq!, hash: sealed.hash! };
  }
  return chronological.reverse();
};

describe("audit > SHA-256", () => {
  it("respecte les vecteurs officiels", () => {
    expect(sha256("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("gère l'UTF-8 (accents des libellés français)", () => {
    expect(sha256("écriture créée")).toHaveLength(64);
    expect(sha256("écriture créée")).not.toBe(sha256("ecriture creee"));
  });

  it("est déterministe et sensible au moindre changement", () => {
    const a = canonicalPayload(log(), 0);
    const b = canonicalPayload(log({ after: "Écriture créée " }), 0);
    expect(a).not.toBe(b);
    expect(sha256(a)).toBe(sha256(a));
    expect(sha256(a)).not.toBe(sha256(b));
  });
});

describe("audit > scellement", () => {
  it("la première entrée part de la racine explicite", () => {
    const first = sealLog(log(), null);
    expect(first.seq).toBe(0);
    expect(first.prevHash).toBe(GENESIS_HASH);
    expect(first.hash).toHaveLength(64);
  });

  it("chaque entrée référence l'empreinte de la précédente", () => {
    const sealed = chain(3);
    const chronological = [...sealed].reverse();
    expect(chronological[1].prevHash).toBe(chronological[0].hash);
    expect(chronological[2].prevHash).toBe(chronological[1].hash);
    expect(new Set(chronological.map((l) => l.hash)).size).toBe(3);
  });
});

describe("audit > vérification", () => {
  it("une chaîne intacte est reconnue", () => {
    const v = verifyAuditChain(chain(5));
    expect(v.ok).toBe(true);
    expect(v.sealed).toBe(5);
    expect(v.unsealed).toBe(0);
    expect(v.brokenAt).toBeNull();
  });

  it("une modification de contenu est détectée et localisée", () => {
    const logs = chain(4);
    // Le plus récent est en tête : on altère le 3e plus ancien.
    logs[1] = { ...logs[1], after: "Action modifiée après coup" };
    const v = verifyAuditChain(logs);
    expect(v.ok).toBe(false);
    expect(v.brokenAt).toBe(3);
    expect(v.reason).toContain("modifiée");
  });

  it("une suppression est détectée", () => {
    const logs = chain(4);
    logs.splice(1, 1); // retire une entrée scellée du milieu
    const v = verifyAuditChain(logs);
    expect(v.ok).toBe(false);
    expect(v.brokenAt).not.toBeNull();
  });

  it("un déplacement d'entrées est détecté", () => {
    const logs = chain(4);
    [logs[1], logs[2]] = [logs[2], logs[1]];
    expect(verifyAuditChain(logs).ok).toBe(false);
  });

  it("les entrées antérieures au scellement sont signalées, pas accusées", () => {
    const legacy: AuditLog = log({ id: "ancien", createdAt: "2026-01-01T00:00:00.000Z" });
    const v = verifyAuditChain([...chain(2), legacy]);
    expect(v.ok).toBe(true);
    expect(v.unsealed).toBe(1);
    expect(v.sealed).toBe(2);
  });

  it("les actions réelles de l'application scellent bien leurs traces", async () => {
    const db = seedDatabase();
    const before = db.auditLogs.filter((l) => l.hash).length;
    runPayroll(db.companies[0].id, "novembre 2026");
    // Les mutations du store passent par une file sérialisée : on laisse le
    // flush se produire avant de lire (comportement documenté de store.ts).
    await new Promise((r) => setTimeout(r, 150));
    const logs = getDB().auditLogs;
    const sealed = logs.filter((l) => l.hash).length;
    expect(sealed).toBeGreaterThan(before);
    const v = verifyAuditChain(logs);
    expect(v.ok).toBe(true);
    expect(v.sealed).toBe(sealed);
  });

  it("un journal vide est valide (rien à vérifier, rien à accuser)", () => {
    const v = verifyAuditChain([]);
    expect(v.ok).toBe(true);
    expect(v.total).toBe(0);
  });
});
