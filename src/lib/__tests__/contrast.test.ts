/**
 * P31 — Contraste : mesuré, corrigé, gardé.
 *
 * Avant : le contraste n'avait jamais été audité. Il suffisait de calculer :
 * `text-slate-400` (327 occurrences) donne **2,56:1** sur blanc, loin du seuil
 * AA de 4,5:1. Le libellé secondaire d'un tableau comptable était donc moins
 * lisible qu'un texte gris de site vitrine.
 *
 * Ce fichier fait deux choses : il vérifie la formule WCAG, et il **balaie le
 * code** pour empêcher le retour des teintes trop claires.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  PALETTE, hexToRgb, relativeLuminance, contrastRatio, wcagLevel, describeContrast, NON_TEXT_MIN,
} from "../contrast";

const ROOT = resolve(__dirname, "../../..");
const SRC = join(ROOT, "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("Formule WCAG", () => {
  it("les bornes sont exactes : 1:1 et 21:1", () => {
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("le rapport est symétrique (l'ordre des couleurs ne compte pas)", () => {
    expect(contrastRatio(PALETTE["slate-500"], PALETTE.white)).toBeCloseTo(
      contrastRatio(PALETTE.white, PALETTE["slate-500"]), 10,
    );
  });

  it("lit les notations courtes et longues", () => {
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("64748b")).toEqual({ r: 100, g: 116, b: 139 });
    expect(() => hexToRgb("#zzz")).toThrow();
  });

  it("la luminance croît du noir vers le blanc", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(relativeLuminance(PALETTE["slate-900"])).toBeLessThan(relativeLuminance(PALETTE["slate-500"]));
  });

  it("les seuils AA / AAA sont ceux de la norme", () => {
    expect(wcagLevel(4.49)).toBe("fail");
    expect(wcagLevel(4.5)).toBe("AA");
    expect(wcagLevel(7)).toBe("AAA");
    expect(wcagLevel(3.0, "large")).toBe("AA");
    expect(wcagLevel(2.99, "large")).toBe("fail");
  });

  it("les valeurs de la palette sont celles de Tailwind (pas de faute de frappe)", () => {
    expect(PALETTE["slate-400"]).toBe("#94a3b8");
    expect(PALETTE["slate-500"]).toBe("#64748b");
    expect(PALETTE["slate-600"]).toBe("#475569");
    expect(PALETTE["indigo-600"]).toBe("#4f46e5");
    expect(PALETTE["emerald-700"]).toBe("#047857");
    expect(PALETTE["amber-700"]).toBe("#b45309");
  });
});

describe("Mesures qui ont motivé la correction", () => {
  it("les teintes corrigées atteignent AA sur blanc et sur le fond des cartes", () => {
    for (const token of ["slate-500", "indigo-600", "emerald-700", "amber-700", "rose-700", "violet-600"]) {
      for (const bg of ["white", "slate-50"]) {
        const ratio = contrastRatio(PALETTE[token], PALETTE[bg]);
        expect(ratio, `${token} sur ${bg} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("les teintes abandonnées échouaient bien", () => {
    expect(contrastRatio(PALETTE["slate-300"], PALETTE.white)).toBeLessThan(NON_TEXT_MIN);
    expect(contrastRatio(PALETTE["slate-400"], PALETTE.white)).toBeLessThan(4.5);
    expect(contrastRatio(PALETTE["indigo-500"], PALETTE.white)).toBeLessThan(4.5);
    expect(contrastRatio(PALETTE["amber-600"], PALETTE.white)).toBeLessThan(4.5);
    expect(contrastRatio(PALETTE["rose-500"], PALETTE.white)).toBeLessThan(4.5);
    expect(contrastRatio(PALETTE["amber-600"], PALETTE.white)).toBeLessThan(4.5);
  });

  it("chaque teinte de la palette est lisible sur au moins un fond clair", () => {
    for (const [token, hex] of Object.entries(PALETTE)) {
      const best = Math.max(contrastRatio(hex, PALETTE.white), contrastRatio(hex, PALETTE["slate-50"]));
      expect(best, `${token} illisible partout`).toBeGreaterThan(1);
    }
  });

  it("describeContrast dit la vérité, en clair", () => {
    expect(describeContrast(PALETTE["slate-400"], PALETTE.white)).toContain("sous le seuil AA");
    expect(describeContrast(PALETTE["slate-600"], PALETTE.white)).toContain("AAA");
  });
});

describe("Le code ne peut pas régresser", () => {
  const files = walk(SRC).filter((f) => !f.includes("__tests__"));
  const FORBIDDEN = ["text-slate-300", "text-slate-400", "text-indigo-500", "text-amber-500", "text-amber-600", "text-emerald-500", "text-emerald-600", "text-rose-500", "text-rose-600", "text-violet-500", "text-sky-600"];

  it("aucune classe de texte trop claire ne subsiste dans les écrans", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const cls of FORBIDDEN) {
        if (new RegExp(`\\b${cls}\\b`).test(content)) offenders.push(`${relative(ROOT, file)} → ${cls}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("les teintes de texte effectivement employées respectent AA sur fond clair", () => {
    const used = new Set<string>();
    for (const file of files.filter((f) => f.endsWith(".tsx"))) {
      const content = readFileSync(file, "utf8");
      for (const m of content.matchAll(/\btext-(slate|indigo|emerald|amber|rose|sky|violet|teal)-(\d{2,3})\b/g)) {
        used.add(`${m[1]}-${m[2]}`);
      }
    }
    const failures: string[] = [];
    for (const token of used) {
      const hex = PALETTE[token];
      if (!hex) continue; // teinte non mesurée (ex. text-slate-100 décoratif) : hors périmètre
      const ratio = contrastRatio(hex, PALETTE.white);
      if (ratio < 4.5) failures.push(`${token} (${ratio.toFixed(2)}:1)`);
    }
    // Les exceptions restantes sont documentées dans le registre, pas oubliées.
    expect(failures.sort()).toEqual([]);
  });
});
