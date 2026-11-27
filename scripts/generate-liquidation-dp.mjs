#!/usr/bin/env node
// ============================================================================
// FIMAAC — Générateur programmatique des formules « Liquidation DP » (DOCUMENT 4)
// Génère les 1002 lignes (18 → 1019) du patron maître confirmé identique.
// Run: node scripts/generate-liquidation-dp.mjs > docs/_liquidation_dp_generated.md
// ============================================================================
const LINES = [];
const FIRST = 18;
const LAST = 1019;

// Formule maître du barème sectoriel (colonne G) — {n} est le seul token variable
const MASTER_G = (n) =>
  `=IF(OR(E${n}="",F${n}=""),"",IF(OR(E${n}="COMMERCE",E${n}="HOTELLERIE",E${n}="PHARMACIES"),IF(F${n}<=500000000,0.55%,IF(AND(500000000<F${n},F${n}<=10000000000),0.6%,IF(AND(10000000000<F${n},F${n}<=50000000000),0.65%,0.7%))),IF(OR(E${n}="SERVICES",E${n}="ASSURANCE",E${n}="BANQUES ET ETS FINANCIERS",E${n}="BTP"),IF(F${n}<=500000000,0.75%,IF(AND(500000000<F${n},F${n}<=10000000000),0.8%,IF(AND(10000000000<F${n},F${n}<=50000000000),1%,1.2%))),IF(OR(E${n}="TELEPHONIE",E${n}="TECHNOLOGIE DE L'INFORMATION"),IF(F${n}<=500000000,0.8%,IF(AND(500000000<F${n},F${n}<=10000000000),0.95%,IF(AND(10000000000<F${n},F${n}<=50000000000),1%,1.2%))),IF(E${n}="INDUSTRIES",IF(F${n}<=500000000,0.7%,IF(AND(500000000<F${n},F${n}<=10000000000),0.8%,IF(AND(10000000000<F${n},F${n}<=50000000000),0.9%,1%))),)))))`;

for (let n = FIRST; n <= LAST; n++) {
  // D{n} — VLOOKUP du code activité (exception : ligne 24 n'a pas de D24)
  if (n !== 24) {
    LINES.push(`| D${n} | =IFERROR(VLOOKUP('Liquidation DP'!C${n},'Liquidation DP'!$M$9:$N$126,2,FALSE),"") |`);
  }

  // F18 — seule ligne 18 pointe vers le CA du compte de résultat
  if (n === 18) {
    LINES.push(`| F18 | ='COMPTE DE RESULTAT'!I17 |`);
  }

  // G{n} — formule maître
  LINES.push(`| G${n} | ${MASTER_G(n)} |`);

  // H{n} — droit = F × G
  LINES.push(`| H${n} | =IFERROR(F${n}*G${n},"") |`);

  // J{n} — reste à payer = H − I
  LINES.push(`| J${n} | =IFERROR((H${n}-I${n})," ") |`);
}

const totalFormulas = (LAST - FIRST + 1) * 4 - 1 + 1; // 4 par ligne, -1 (pas de D24), +1 (F18)

console.log(`# Liquidation DP — lignes ${FIRST} → ${LAST} (généré programmatiquement)\n`);
console.log(`> Total formules générées : ${LINES.length} (patron maître confirmé identique)\n`);
console.log(`| Cellule | Formule exacte |`);
console.log(`|---|---|`);
console.log(LINES.join('\n'));
console.log(`\n---\n> ✅ **FEUILLE 69 \`Liquidation DP\` — 100% COUVERTE (${LAST - FIRST + 1} lignes, ${totalFormulas} formules totales).**`);
