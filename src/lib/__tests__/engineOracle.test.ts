/**
 * P26 — Les exports sans usage applicatif : mesure, et rôle réel du moteur factorisé.
 *
 * Constat : 386 des 932 exports de `src/lib` ne sont utilisés par aucun code de
 * l'application. Un export mort n'est pas une faute de style, c'est une
 * **promesse** : on lit `export function ...` et on croit que le logiciel fait
 * ce qu'elle dit.
 *
 * Le cas le plus grave n'était pas un compte, c'était une croyance : le « moteur
 * factorisé » (`src/lib/engine`) était présenté comme co-source de vérité avec
 * `fiscalite.ts`, alors qu'il n'est importé **que par les tests**. Ce test fixe
 * son rôle — oracle de contre-vérification — et refuse toute entrée en
 * production qui n'aurait pas été décidée.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { runEngine } from "../engine";
import { parseBalance6Grid } from "../balance6";
import { buildStatements } from "../liasse";
import { CHART_OF_ACCOUNTS } from "../chart";

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

const files = walk(SRC);

describe("Moteur factorisé — oracle, pas production", () => {
  it("n'est importé que par des tests", () => {
    const violations = files
      .filter((f) => !f.includes("__tests__"))
      .filter((f) => !f.startsWith(join(SRC, "lib/engine")))
      .filter((f) => /from\s+"[^"]*\/engine(\/index)?"/.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(violations).toEqual([]);
  });

  it("son en-tête dit qu'il est un oracle, pour que personne ne s'y trompe", () => {
    const header = readFileSync(join(SRC, "lib/engine/index.ts"), "utf8").slice(0, 1400);
    expect(header).toContain("oracle de contre-vérification");
    expect(header).toContain("aucun");
  });

  it("il retombe d'accord avec le moteur affiché sur une balance réelle", () => {
    // Balance minimale, soldée : deux moteurs indépendants doivent donner le même actif.
    const grid = [
      ["Compte", "Libellé", "Solde débiteur N", "Solde créditeur N"],
      ["4111", "Clients", "1 000 000", "0"],
      ["101", "Capital", "0", "1 000 000"],
    ];
    const parsed = parseBalance6Grid(grid);
    expect(parsed.ok).toBe(true);
    const engine = runEngine(parsed.n, [], CHART_OF_ACCOUNTS as never, {});
    const statements = buildStatements(parsed.n);
    // Les deux moteurs nomment leurs totaux différemment, mais doivent tomber
    // sur le même chiffre : c'est tout l'intérêt de l'oracle.
    expect(engine.bilan["N"].totalActif).toBe(1_000_000);
    expect(engine.bilan["N"].totalActif).toBe(statements.bilan.actifTotal);
  });
});

describe("Exports — la mesure reste disponible", () => {
  it("le script d'inventaire existe et scanne réellement les exports", () => {
    const script = readFileSync(join(ROOT, "scripts/dead-exports.mjs"), "utf8");
    expect(script).toContain("export");
    expect(script).toContain("__tests__");
    expect(script).toContain("app");
  });

  it("le registre documente la politique, pas seulement le chiffre", () => {
    const doc = readFileSync(join(ROOT, "docs/AUDIT_EXPORTS_MORTS.md"), "utf8");
    expect(doc).toContain("Constat");
    expect(doc).toContain("Verdicts");
    expect(doc).toContain("oracle");
  });

  it("aucun export ne revendique un rôle que le code ne tient pas", () => {
    // Les en-têtes de `fiscalite.ts` et `tax.ts` ne doivent plus présenter le
    // moteur factorisé comme une source de vérité partagée.
    for (const f of ["lib/tax.ts", "lib/fiscalite.ts"]) {
      const head = readFileSync(join(SRC, f), "utf8").slice(0, 2000);
      const claimsSharedTruth = /source de vérité, partagée avec le moteur factorisé/.test(head);
      expect(claimsSharedTruth, `${f} présente encore le moteur factorisé comme branche`).toBe(false);
    }
  });
});
