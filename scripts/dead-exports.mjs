#!/usr/bin/env node
// ============================================================================
// FIMAAC — Inventaire des exports jamais utilisés (point 21 du registre).
//
// Un export mort n'est pas une faute de style : c'est une promesse. Quelqu'un
// lit `export function validerLiasse()` et croit que le logiciel valide une
// liasse. Ici, on mesure : pour chaque export de `src/lib`, on compte les usages
// **hors du fichier qui le déclare** et **hors des tests**.
//
// Usage : node scripts/dead-exports.mjs [--json]
// ============================================================================
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const SRC = join(ROOT, "src");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const all = walk(SRC);
const appFiles = all.filter((f) => !f.includes("__tests__"));
const testFiles = all.filter((f) => f.includes("__tests__"));

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const exportsByFile = new Map();
for (const f of appFiles) {
  const src = stripComments(readFileSync(f, "utf8"));
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|const|class|type|interface|enum)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  if (names.size) exportsByFile.set(f, [...names]);
}

/** Un usage = le nom apparaît ailleurs que dans sa déclaration. */
const countUsages = (name, ownerFile) => {
  let app = 0;
  let tests = 0;
  for (const f of all) {
    if (f === ownerFile) continue;
    const src = readFileSync(f, "utf8");
    const re = new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`, "g");
    const hits = (src.match(re) || []).length;
    if (!hits) continue;
    // Une mention en commentaire ne compte pas comme un usage.
    const code = stripComments(src);
    const realHits = (code.match(re) || []).length;
    if (!realHits) continue;
    if (f.includes("__tests__")) tests += realHits;
    else app += realHits;
  }
  return { app, tests };
};

const dead = [];
for (const [file, names] of exportsByFile) {
  for (const name of names) {
    const { app, tests } = countUsages(name, file);
    if (app === 0) {
      const lines = readFileSync(file, "utf8").split("\n").length;
      dead.push({ file: relative(ROOT, file), name, tests, lines });
    }
  }
}

const byFile = new Map();
for (const d of dead) {
  if (!byFile.has(d.file)) byFile.set(d.file, []);
  byFile.get(d.file).push(d);
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(dead, null, 2));
} else {
  console.log(`Exports sans usage applicatif : ${dead.length} sur ${[...exportsByFile.values()].flat().length}`);
  console.log(`Dont utilisés uniquement par des tests : ${dead.filter((d) => d.tests > 0).length}\n`);
  for (const [file, items] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${file}  (${items.length})`);
    for (const i of items) console.log(`   - ${i.name}${i.tests ? `  [tests: ${i.tests}]` : ""}`);
  }
}
