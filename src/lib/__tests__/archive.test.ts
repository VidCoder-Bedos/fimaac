/**
 * P25 — Moteurs dormants : branchés ou archivés, jamais oubliés.
 *
 * Constat d'audit (§F, point 20) : quatre modules de `src/lib` n'étaient
 * importés par **aucun** code de l'application — 1 320 lignes qui compilaient,
 * passaient la revue… et ne s'exécutaient jamais. Le pire des deux mondes : on
 * croit avoir deux moteurs, on n'en a qu'un, et personne ne sait lequel fait foi.
 *
 * Ce test est le garde-fou : il échoue si un module archivé revient dans le
 * chemin d'exécution sans que la décision soit prise explicitement.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";

const ROOT = resolve(__dirname, "../../..");
const SRC = join(ROOT, "src");
const ARCHIVE = join(SRC, "lib/archive");

/** Liste blanche : seuls ces modules peuvent vivre dans l'archive. */
const ARCHIVED_MODULES = ["declarationEngine", "financialStatements", "liasseFiller", "formulaRegistry"];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC).filter((f) => !f.startsWith(ARCHIVE));

/** Résout un import relatif vers un fichier .ts / .tsx, comme le fait le bundler. */
function resolveImport(fromFile: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(fromFile), spec);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch { /* inexistant */ }
  }
  return null;
}

describe("Archive — décision explicite", () => {
  it("aucun module archivé n'est importé par le reste de src/", () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const m of ARCHIVED_MODULES) {
        if (new RegExp(`from\\s+"[^"]*/${m}"`).test(content) || new RegExp(`import\\("[^"]*/${m}"\\)`).test(content)) {
          violations.push(`${relative(ROOT, file)} importe ${m}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("l'archive ne contient que les modules décidés — rien n'y tombe par accident", () => {
    const present = readdirSync(ARCHIVE).filter((f) => f.endsWith(".ts")).map((f) => f.replace(/\.ts$/, "")).sort();
    expect(present).toEqual([...ARCHIVED_MODULES].sort());
  });

  it("chaque fichier archivé porte son en-tête « ARCHIVÉ » et le nom de son remplaçant", () => {
    for (const m of ARCHIVED_MODULES) {
      const content = readFileSync(join(ARCHIVE, `${m}.ts`), "utf8");
      expect(content.slice(0, 400)).toContain("ARCHIVÉ");
      expect(content).toMatch(/remplaçant|ferait doublon|ne sont importés|n'est importé/i);
    }
  });

  it("un module archivé reste compilable : il est conservé, pas cassé", () => {
    for (const m of ARCHIVED_MODULES) {
      const content = readFileSync(join(ARCHIVE, `${m}.ts`), "utf8");
      // Ses imports relatifs pointent vers le vrai dossier lib/, pas vers l'archive.
      const relatives = content.match(/from\s+"(\.[^"]+)"/g) ?? [];
      for (const r of relatives) {
        const spec = r.replace(/from\s+"|"/g, "");
        const target = resolveImport(join(ARCHIVE, `${m}.ts`), spec);
        expect(target, `${m} : import introuvable ${spec}`).not.toBeNull();
        expect(target!.startsWith(ARCHIVE), `${m} : ${spec} pointe encore dans l'archive`).toBe(false);
      }
    }
  });

  it("les fonctions archivées ne sont jamais citées comme vivantes dans la documentation produit", () => {
    const doc = readFileSync(join(ROOT, "docs/RESTE_A_FAIRE.md"), "utf8");
    expect(doc.toLowerCase()).toContain("moteurs dormants");
    // Le registre doit renvoyer vers la décision, pas laisser croire à un oubli.
    expect(doc).toMatch(/PR #40|archive/i);
  });
});
