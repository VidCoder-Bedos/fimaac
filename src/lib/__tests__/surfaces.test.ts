/**
 * P32 — Les fonds pleins : ce que P31 n'avait pas vu.
 *
 * P31 avait mesuré les classes de texte sur fond clair. Restaient trois angles
 * morts, tous visibles en calculant :
 *
 *   - le texte **blanc** posé sur un fond **plein** : 2,15:1 sur `amber-500`,
 *     2,54:1 sur `emerald-500`, 2,77:1 sur `sky-500` — les puces du calendrier
 *     des obligations et les compteurs de documents étaient donc illisibles ;
 *   - les **couleurs venues des données** (`avatarColor`, `logoColor`) : les
 *     initiales blanches de trois utilisateurs de démonstration tombaient à
 *     2,15:1 sur `#f59e0b` ;
 *   - les **graphiques**, dessinés en SVG : leurs libellés étaient peints en
 *     `fill="#94a3b8"` (2,56:1) et, pire, en `fill={couleur de la série}` — donc
 *     1,52:1 sur les segments clairs de la composition des produits.
 *
 * Ce fichier mesure ces trois cas et balaie le code pour qu'ils ne reviennent
 * pas. Les exceptions sont **déclarées** ici, avec leur raison — pas oubliées.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  PALETTE, contrastRatio, bestTextOn, bestTextRatio, INK_LIGHT, INK_DARK, NON_TEXT_MIN,
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

const files = walk(SRC).filter((f) => !f.includes("__tests__"));
const read = (f: string) => readFileSync(f, "utf8");
const lines = (f: string) => read(f).split("\n");

/** Classes de fond *pleines* (teintes moyennes/foncées) — les seules qui portent une encre. */
const SOLID_BG = /\bbg-(slate|indigo|emerald|amber|rose|sky|violet|teal)-(\d{2,3})\b/g;

describe("L'encre se choisit par la mesure", () => {
  it("sur un fond clair, l'encre blanche est retenue ; sur un fond sombre, l'ardoise", () => {
    expect(bestTextOn("#4f46e5")).toBe(INK_LIGHT); // indigo-600 : 6,29:1 en blanc
    expect(bestTextOn("#be123c")).toBe(INK_LIGHT); // rose-700 : 6,29:1 en blanc
    expect(bestTextOn("#f59e0b")).toBe(INK_DARK); // amber-500 : 2,15:1 en blanc, 8,31:1 en ardoise
    expect(bestTextOn("#34d399")).toBe(INK_DARK); // emerald-400 : 1,92:1 en blanc
    expect(bestTextOn("#10b981")).toBe(INK_DARK); // emerald-500 : 2,54:1 en blanc
  });

  it("le blanc reste l'encre retenue en cas d'égalité (pas de bascule arbitraire)", () => {
    // #8b5cf6 : 4,23:1 en blanc, 4,22:1 en ardoise — le blanc l'emporte de peu.
    expect(bestTextOn("#8b5cf6")).toBe(INK_LIGHT);
  });

  it("bestTextRatio dit le maximum atteignable, même quand il reste insuffisant", () => {
    expect(bestTextRatio("#f59e0b")).toBeCloseTo(8.31, 1);
    // Aucune encre ne sauve `sky-600` (4,36:1 au mieux) : le mesurer vaut mieux que le supposer.
    expect(bestTextRatio(PALETTE["sky-600"])).toBeLessThan(4.5);
    expect(bestTextRatio(PALETTE["sky-600"])).toBeGreaterThan(NON_TEXT_MIN);
  });

  it("les couleurs de personnes et d'organisations, venues des données, restent lisibles", () => {
    const sources = ["src/lib/seed.ts", "src/lib/actions.ts"].map((p) => join(ROOT, p));
    const failing: string[] = [];
    let seen = 0;
    for (const file of sources) {
      for (const m of read(file).matchAll(/(avatarColor|logoColor):\s*"(#[0-9a-fA-F]{6})"/g)) {
        seen++;
        const ratio = bestTextRatio(m[2]);
        if (ratio < 4.5) failing.push(`${relative(ROOT, file)} → ${m[1]} ${m[2]} (${ratio.toFixed(2)}:1)`);
      }
    }
    expect(seen).toBeGreaterThan(5);
    expect(failing).toEqual([]);
  });
});

describe("Le texte blanc sur fond plein atteint AA", () => {
  it("les teintes retenues pour les puces du calendrier passent 4,5:1 en blanc", () => {
    for (const token of ["rose-700", "amber-700", "sky-700", "slate-600"]) {
      const ratio = contrastRatio(INK_LIGHT, PALETTE[token]);
      expect(ratio, `blanc sur ${token} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("les teintes abandonnées échouaient bien (mesure, pas intuition)", () => {
    expect(contrastRatio(INK_LIGHT, PALETTE["amber-500"])).toBeLessThan(2.5);
    expect(contrastRatio(INK_LIGHT, PALETTE["emerald-500"])).toBeLessThan(NON_TEXT_MIN);
    expect(contrastRatio(INK_LIGHT, PALETTE["sky-500"])).toBeLessThan(NON_TEXT_MIN);
    expect(contrastRatio(INK_LIGHT, PALETTE["slate-400"])).toBeLessThan(NON_TEXT_MIN);
  });

  it("aucune classe de texte blanc ne cohabite avec un fond trop clair pour elle", () => {
    const failures: string[] = [];
    for (const file of files.filter((f) => f.endsWith(".tsx"))) {
      for (const line of lines(file)) {
        // Les classes sont réparties dans des chaînes littérales : on mesure chacune.
        for (const chunk of line.match(/"[^"]*"/g) || []) {
          if (!/\btext-white\b/.test(chunk)) continue;
          for (const m of chunk.matchAll(SOLID_BG)) {
            const token = `${m[1]}-${m[2]}`;
            const hex = PALETTE[token];
            if (!hex) continue; // teinte non mesurée : hors palette, donc hors périmètre
            const ratio = contrastRatio(INK_LIGHT, hex);
            if (ratio < 4.5) failures.push(`${relative(ROOT, file)} → texte blanc sur ${token} (${ratio.toFixed(2)}:1)`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("Les pastilles et tracés atteignent le minimum non-textuel", () => {
  /** Exceptions déclarées : pastille décorative posée sur la tuile dégradée de marque. */
  const EXCEPTIONS = [
    { file: "src/components/AppLayout.tsx", cls: "bg-emerald-400", why: "pastille « en direct » sur dégradé indigo, aucune information portée" },
    { file: "src/pages/Landing.tsx", cls: "bg-emerald-400", why: "idem, vignette de démonstration de la page d'accueil" },
  ];

  it("aucun aplat ne descend sous 3:1 sur le fond des cartes, hors exceptions déclarées", () => {
    const failures: string[] = [];
    for (const file of files.filter((f) => f.endsWith(".tsx"))) {
      const rel = relative(ROOT, file);
      for (const line of lines(file)) {
        for (const m of line.matchAll(SOLID_BG)) {
          const shade = Number(m[2]);
          if (shade !== 400 && shade !== 500) continue;
          const token = `${m[1]}-${m[2]}`;
          const hex = PALETTE[token];
          if (!hex) continue;
          if (EXCEPTIONS.some((e) => e.file === rel && e.cls === `bg-${token}`)) continue;
          const ratio = contrastRatio(hex, PALETTE.white);
          if (ratio < NON_TEXT_MIN) failures.push(`${rel} → ${token} (${ratio.toFixed(2)}:1)`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("les exceptions déclarées sont bien celles qui restent, et elles sont mesurées", () => {
    for (const e of EXCEPTIONS) {
      const token = e.cls.replace("bg-", "");
      expect(read(join(ROOT, e.file)), `${e.file} ne contient plus ${e.cls}`).toContain(e.cls);
      expect(contrastRatio(PALETTE[token], PALETTE.white), e.why).toBeLessThan(NON_TEXT_MIN);
    }
  });
});

describe("Les graphiques : le libellé ne se peint pas de la couleur de la série", () => {
  const charts = join(SRC, "components/charts.tsx");

  it("aucun texte SVG n'hérite d'une couleur variable (donc non mesurable)", () => {
    const offenders = lines(charts)
      .filter((l) => /<text\b/.test(l) && /fill=\{/.test(l))
      .map((l) => l.trim().slice(0, 80));
    expect(offenders).toEqual([]);
  });

  it("chaque couleur de texte SVG fixée atteint 4,5:1 sur blanc", () => {
    const failures: string[] = [];
    for (const line of lines(charts)) {
      if (!/<text\b/.test(line)) continue;
      for (const m of line.matchAll(/fill="(#[0-9a-fA-F]{6})"/g)) {
        const ratio = contrastRatio(m[1], PALETTE.white);
        if (ratio < 4.5) failures.push(`${m[1]} (${ratio.toFixed(2)}:1)`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("le pourcentage de la barre de composition se lit sur une pastille opaque", () => {
    const content = read(charts);
    expect(content).not.toMatch(/text-\[10px\] font-bold text-white/);
    expect(content).toContain("rounded bg-white/95 px-1 text-[10px] font-bold text-slate-900");
  });

  /**
   * Teintes claires **assumées**, avec leur raison : elles ne portent ni texte ni
   * valeur. Tout le reste doit atteindre 3:1 sur le fond des cartes.
   */
  const PALE_ALLOWED: { file: string; hex: string; why: string }[] = [
    { file: "src/components/ui.tsx", hex: "#10b981", why: "halo flouté derrière une tuile KPI (décoration)" },
    { file: "src/components/ui.tsx", hex: "#f59e0b", why: "halo flouté derrière une tuile KPI (décoration)" },
    { file: "src/components/ui.tsx", hex: "#0ea5e9", why: "halo flouté derrière une tuile KPI (décoration)" },
    { file: "src/pages/Dashboard.tsx", hex: "#34d399", why: "2e teinte de la barre de composition, nommée en légende" },
    { file: "src/pages/Dashboard.tsx", hex: "#6ee7b7", why: "3e teinte de la barre de composition, nommée en légende" },
    { file: "src/pages/Dashboard.tsx", hex: "#a3e635", why: "4e teinte de la barre de composition, nommée en légende" },
    { file: "src/pages/Dashboard.tsx", hex: "#84cc16", why: "5e teinte de la barre de composition, nommée en légende" },
    { file: "src/pages/Dashboard.tsx", hex: "#a78bfa", why: "teinte de la barre de composition des charges, nommée en légende" },
    { file: "src/pages/Dashboard.tsx", hex: "#ec4899", why: "teinte de la barre de composition des charges, nommée en légende" },
  ];

  it("les teintes autrefois trop claires ne reviennent pas hors dérogation motivée", () => {
    const PALE = ["#94a3b8", "#818cf8", "#10b981", "#f59e0b", "#0ea5e9", "#34d399", "#6ee7b7", "#a78bfa", "#a3e635", "#84cc16", "#ec4899", "#fb7185"];
    const failures: string[] = [];
    for (const file of files.filter((f) => f.endsWith(".tsx"))) {
      const rel = relative(ROOT, file);
      const content = read(file);
      for (const hex of PALE) {
        if (!content.includes(`"${hex}"`)) continue;
        if (PALE_ALLOWED.some((a) => a.file === rel && a.hex === hex)) continue;
        const ratio = contrastRatio(hex, PALETTE.white);
        if (ratio < NON_TEXT_MIN) failures.push(`${rel} → ${hex} (${ratio.toFixed(2)}:1)`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("chaque dérogation est motivée et réellement employée", () => {
    for (const a of PALE_ALLOWED) {
      expect(a.why.length, `${a.hex} sans raison`).toBeGreaterThan(20);
      expect(read(join(ROOT, a.file)), `${a.file} n'emploie plus ${a.hex}`).toContain(`"${a.hex}"`);
    }
  });
});
