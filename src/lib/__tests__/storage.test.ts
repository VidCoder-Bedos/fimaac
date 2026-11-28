/**
 * P0-5 — Recette du garde-fou de stockage.
 *
 * Le défaut corrigé : `persist()` avalait l'erreur de quota. Au-delà de la
 * limite du navigateur, l'application continuait d'afficher des écritures qui
 * n'étaient plus écrites nulle part. Ici on vérifie que l'état est calculable,
 * lisible, et surtout que le silence n'est plus possible.
 */
import { describe, it, expect } from "vitest";
import {
  measureUsage,
  measureSerialized,
  byteLength,
  humanBytes,
  backupFileName,
  storageMessage,
  STORAGE_BUDGET_BYTES,
  QUOTA_WARN_RATIO,
  QUOTA_CRITICAL_RATIO,
} from "../storage";
import { storageSnapshot, exportDB, getDB } from "../store";
import { seedDatabase } from "../seed";

const BUDGET = 1_000_000;

describe("stockage > mesure de l'occupation", () => {
  it("une base vide n'alerte pas", () => {
    const u = measureUsage(0, BUDGET);
    expect(u.percent).toBe(0);
    expect(u.level).toBe("ok");
    expect(u.remainingBytes).toBe(BUDGET);
  });

  it("alerte à 80 % et devient critique à 95 %", () => {
    expect(measureUsage(BUDGET * (QUOTA_WARN_RATIO - 0.01), BUDGET).level).toBe("ok");
    expect(measureUsage(BUDGET * QUOTA_WARN_RATIO, BUDGET).level).toBe("warn");
    expect(measureUsage(BUDGET * (QUOTA_CRITICAL_RATIO - 0.01), BUDGET).level).toBe("warn");
    expect(measureUsage(BUDGET * QUOTA_CRITICAL_RATIO, BUDGET).level).toBe("critical");
  });

  it("un dépassement reste lisible et ne produit pas de reste négatif", () => {
    const u = measureUsage(BUDGET * 1.4, BUDGET);
    expect(u.level).toBe("critical");
    expect(u.percent).toBe(140);
    expect(u.remainingBytes).toBe(0);
  });

  it("le budget par défaut est celui du localStorage le plus bas courant (5 Mio)", () => {
    expect(STORAGE_BUDGET_BYTES).toBe(5 * 1024 * 1024);
    expect(measureUsage(0).budgetBytes).toBe(STORAGE_BUDGET_BYTES);
  });

  it("les octets comptés suivent l'encodage réel, accents compris", () => {
    expect(byteLength("abc")).toBe(3);
    expect(byteLength("éàü")).toBeGreaterThanOrEqual(3);
    expect(measureSerialized('{"a":1}').bytes).toBe(7);
  });

  it("formate les tailles en français", () => {
    expect(humanBytes(512)).toBe("512 o");
    expect(humanBytes(1536)).toBe("1,5 ko");
    expect(humanBytes(2.5 * 1024 * 1024)).toBe("2,5 Mo");
    expect(humanBytes(12 * 1024 * 1024)).toBe("12 Mo");
  });
});

describe("stockage > messages", () => {
  it("l'état normal rappelle que les données sont locales et exportables", () => {
    const m = storageMessage(measureUsage(1000, BUDGET));
    expect(m.tone).toBe("info");
    expect(m.title).toContain("démonstration");
    expect(m.detail).toContain("navigateur");
  });

  it("un échec d'écriture devient un incident explicite, non refermable", () => {
    const m = storageMessage(measureUsage(1000, BUDGET), "quota de stockage du navigateur dépassé");
    expect(m.tone).toBe("critical");
    expect(m.title).toContain("ne sont plus enregistrées");
    expect(m.detail).toContain("perdu");
  });

  it("un stockage saturé invite à exporter immédiatement", () => {
    const m = storageMessage(measureUsage(BUDGET, BUDGET));
    expect(m.tone).toBe("critical");
    expect(m.title).toContain("100 %");
    expect(m.detail).toContain("Exportez");
  });
});

describe("stockage > sauvegarde", () => {
  it("le nom de fichier est horodaté et stable", () => {
    expect(backupFileName(new Date(2026, 10, 28, 9, 5))).toBe("fimaac-sauvegarde_2026-11-28_0905.json");
  });

  it("l'export sérialise la totalité du dossier", () => {
    const db = seedDatabase();
    const json = exportDB();
    const parsed = JSON.parse(json) as typeof db;
    expect(parsed.companies.length).toBe(db.companies.length);
    expect(parsed.entries.length).toBe(db.entries.length);
    expect(json.length).toBeGreaterThan(1000);
  });

  it("l'instantané de stockage lit l'état réel et reste sous le budget", () => {
    seedDatabase();
    const snap = storageSnapshot();
    expect(snap.usage.bytes).toBeGreaterThan(0);
    expect(snap.usage.level).toBe("ok");
    expect(snap.usage.bytes).toBeLessThan(STORAGE_BUDGET_BYTES);
    expect(snap.persistError).toBeNull();
  });

  it("un dossier chargé reste mesurable et cohérent avec son export", () => {
    seedDatabase();
    const bytes = storageSnapshot().usage.bytes;
    expect(bytes).toBe(byteLength(JSON.stringify(getDB())));
  });
});
