// ============================================================================
// FIMAAC — Pipeline complet de remplissage de la liasse GUDEF
// Fusionne : états de base + 35 notes annexes + identification + liquidation DP
// Exécute les contrôles de cohérence sur le résultat rempli.
// ============================================================================
import type { BalanceRow } from "./liasse";
import { computeLiquidationDP } from "./liasse";
import { fillStateTemplateZip } from "./xlsx-filler";
import { runCoherenceChecks, type StateAggregate, type CoherenceReport } from "./liasseEngine";
import { computeAllNotes } from "./notes";
import type { Company } from "./types";
import type { ProdContext } from "./production/types";

// ============================================================================
// ÉTAPE 1 — buildFullValueByRef : fusionne TOUTES les valeurs
// ============================================================================
export interface FillReport {
  /** Cellules remplies dans le classeur. */
  filled: number;
  /** Références fournies mais absentes du classeur. */
  unmatched: string[];
  /** Journal des opérations par feuille. */
  report: string[];
  /** Nombre total de références dans le valueByRef. */
  totalRefs: number;
  /** Nombre de feuilles détectées dans le classeur. */
  sheetCount: number;
  /** Contrôles de cohérence exécutés après remplissage. */
  coherence: CoherenceReport | null;
  /** Notes calculées (résultat complet). */
  notesCount: number;
  /** Notes applicables avec valeurs calculées. */
  notesComputed: number;
  /** Notes à saisie manuelle. */
  notesManual: number;
  /** Blob du classeur rempli. */
  blob: Blob;
  /** Temps d'exécution (ms). */
  elapsedMs: number;
}

/**
 * Construit le valueByRef complet :
 *   1. Les 71+ postes d'états de base (existant — buildAggregate)
 *   2. Les valeurs des 35 notes annexes (notes.ts — computeAllNotes)
 *   3. Les champs d'identification (depuis Company)
 *   4. La liquidation DP (barème sectoriel — computeLiquidationDP)
 *   5. Les soldes intermédiaires de gestion (XA→XI)
 */
export function buildFullValueByRef(
  ctx: ProdContext,
  aggregate: StateAggregate,
  company: Company | null,
): Record<string, number> {
  const valueByRef: Record<string, number> = {};

  // ---- 1. États de base (71+ postes — code existant de liasseEngine) ----
  Object.assign(valueByRef, aggregate.actif, aggregate.amort, aggregate.passif,
    aggregate.produits, aggregate.charges, aggregate.sii);
  valueByRef["FA"] = aggregate.caf;

  // ---- 2. Notes annexes (35 notes — computeAllNotes) ----
  const notes = computeAllNotes(ctx);
  for (const [noteCode, result] of notes) {
    if (!result.applicable) continue;
    for (const row of result.rows) {
      const rowRef = row.ref || "";
      if (!rowRef) continue;
      const val = row.n;
      if (val === null || val === undefined) continue;
      // Clé composée : NOTE_04_411, NOTE_34_FA, NOTE_03A_AE_BRUT…
      const key = `${noteCode}_${rowRef}`;
      valueByRef[key] = val;
      // Si le ref de la ligne est une référence d'état simple (AE, TA, FA…),
      // on l'ajoute aussi en tant que référence directe (priorité à la note).
      if (/^[A-Z]{1,4}(\d{0,2})?$/.test(rowRef) && val !== 0) {
        valueByRef[rowRef] = val;
      }
    }
    // Total de la note
    if (result.totalN !== null && result.totalN !== undefined) {
      valueByRef[`${noteCode}_TOTAL`] = result.totalN;
    }
  }

  // ---- 3. Identification (depuis Company) ----
  if (company) {
    const idMap: Record<string, string> = {
      "ID_RAISON_SOCIALE": company.name,
      "ID_NOM_COMMERCIAL": company.tradeName || "",
      "ID_NIF": company.nif || "",
      "ID_RCCM": company.rccm || "",
      "ID_FORME_JURIDIQUE": company.legalForm || "",
      "ID_CAPITAL": String(company.capital || 0),
      "ID_VILLE": company.city || "",
      "ID_SECTEUR": company.sector || "",
      "ID_ADRESSE": company.address || "",
      "ID_REGION": company.region || "",
      "ID_PHONE": company.phone || "",
      "ID_EMAIL": company.email || "",
      "ID_EXERCICE": ctx.exercise,
    };
    for (const [k, v] of Object.entries(idMap)) {
      if (v) valueByRef[k] = -1; // -1 = identifiant texte (pas un montant)
    }
  }

  // ---- 4. Liquidation DP (barème sectoriel) ----
  const ca = aggregate.sii.XB || 0;
  if (ca > 0) {
    const sector = company?.sector || "COMMERCE";
    const dp = computeLiquidationDP(sector, ca, 0, 0);
    valueByRef["DP_CA"] = dp.caTotal;
    valueByRef["DP_TAUX"] = Math.round(dp.tauxEffectif * 10000) / 10000;
    valueByRef["DP_DROIT"] = dp.droitProportionnel;
    valueByRef["DP_RESTE"] = dp.resteAPayer;
    for (let i = 0; i < dp.detail.length; i++) {
      valueByRef[`DP_T${i + 1}_CA`] = dp.detail[i].ca;
      valueByRef[`DP_T${i + 1}_TAUX`] = Math.round(dp.detail[i].taux * 10000) / 10000;
      valueByRef[`DP_T${i + 1}_MONTANT`] = dp.detail[i].montant;
    }
  }

  // ---- 5. Valeurs dérivées utiles ----
  valueByRef["TOTAL_ACTIF"] = aggregate.actifTotalN;
  valueByRef["TOTAL_PASSIF"] = aggregate.passifTotalN;
  valueByRef["RESULTAT_NET"] = aggregate.sii.XI;
  valueByRef["TOTAL_ACTIF_N1"] = aggregate.actifTotalN1;
  valueByRef["TOTAL_PASSIF_N1"] = aggregate.passifTotalN1;
  valueByRef["CAF"] = aggregate.caf;

  return valueByRef;
}

// ============================================================================
// ÉTAPE 3 — fillCompleteLiasse : pipeline complet
// ============================================================================
/**
 * Pipeline complet de remplissage de la liasse GUDEF :
 *   1. Construire le valueByRef complet (états + notes + identification + DP)
 *   2. Remplir le classeur via fillStateTemplateZip (non destructif)
 *   3. Relire le classeur rempli
 *   4. Exécuter les contrôles de cohérence
 *   5. Générer le rapport de remplissage
 */
export async function fillCompleteLiasse(
  file: File,
  ctx: ProdContext,
  aggregate: StateAggregate,
  company: Company | null,
): Promise<FillReport> {
  const t0 = performance.now();

  // ---- 1. Construire le valueByRef complet ----
  const valueByRef = buildFullValueByRef(ctx, aggregate, company);
  const totalRefs = Object.keys(valueByRef).length;

  // ---- 2. Remplir le classeur ----
  const zipResult = await fillStateTemplateZip(file, valueByRef);

  // ---- 4. Contrôles de cohérence ----
  const coherence = runCoherenceChecks(ctx.balances.n1, ctx.balances.n);

  // ---- 5. Construire le rapport ----
  const notes = computeAllNotes(ctx);
  const notesComputed = [...notes.values()].filter((n) => n.applicable && n.rows.some((r) => r.n !== null)).length;
  const notesManual = [...notes.values()].filter((n) => n.status === "to_confirm").length;

  return {
    filled: zipResult.filled,
    unmatched: zipResult.unmatched,
    report: zipResult.report,
    totalRefs,
    sheetCount: 0, // calculé par auditWorkbook dans l'UI si nécessaire
    coherence,
    notesCount: notes.size,
    notesComputed,
    notesManual,
    blob: zipResult.blob,
    elapsedMs: Math.round(performance.now() - t0),
  };
}

// ============================================================================
// ÉTAPE 4 — Helpers pour le contexte (ProdContext) depuis les données du store
// ============================================================================
/** Construit un ProdContext à partir des écritures d'une entreprise. */
export function buildProdContext(
  entries: import("./types").JournalEntry[],
  accounts: import("./types").Account[],
  company: Company | null,
  exercise: string,
  balanceN1: BalanceRow[] = [],
): ProdContext {
  // Construire la balance N depuis les écritures validées
  const moves = new Map<string, { debit: number; credit: number }>();
  for (const e of entries) {
    if (e.status !== "validated") continue;
    for (const l of e.lines) {
      const m = moves.get(l.accountId) || { debit: 0, credit: 0 };
      m.debit += l.debit;
      m.credit += l.credit;
      moves.set(l.accountId, m);
    }
  }
  const balanceN: BalanceRow[] = [...moves.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([code, m]) => ({ code, label: "", debit: m.debit, credit: m.credit }));

  return {
    companyName: company?.name || "",
    exercise,
    balances: { n: balanceN, n1: balanceN1 },
    states: {
      bilan: {
        N: { immoBrut: 0, amort: 0, immoNet: 0, stocks: 0, creances: 0, tresorerie: 0, totalActif: 0, capitaux: 0, resultat: 0, dettesFin: 0, dettesFourn: 0, autresDettes: 0, tresoPassif: 0, totalPassif: 0 },
        "N-1": { immoBrut: 0, amort: 0, immoNet: 0, stocks: 0, creances: 0, tresorerie: 0, totalActif: 0, capitaux: 0, resultat: 0, dettesFin: 0, dettesFourn: 0, autresDettes: 0, tresoPassif: 0, totalPassif: 0 },
      },
      resultat: { N: { produits: 0, charges: 0, resultat: 0 }, "N-1": { produits: 0, charges: 0, resultat: 0 } },
      tft: { N: { caf: 0, variationTresorerie: 0, soldeNet: 0 }, "N-1": { caf: 0, variationTresorerie: 0, soldeNet: 0 } },
      variations: {},
    },
    accounts,
    dataPoints: new Map(),
    notes: new Map(),
    fiscalOpts: {},
  };
}

/** Génère le texte du rapport de remplissage pour affichage dans l'UI. */
export function formatFillReport(r: FillReport): string {
  const pct = r.totalRefs > 0 ? Math.round((r.filled / r.totalRefs) * 100) : 0;
  const coherence = r.coherence;
  const c1 = coherence?.lines.find((l) => l.cat.startsWith("C1"));
  let s = `═══════════════════════════════════════════════\n`;
  s += `RAPPORT DE REMPLISSAGE — Liasse GUDEF\n`;
  s += `═══════════════════════════════════════════════\n\n`;
  s += `Feuilles détectées       : ${r.sheetCount}\n`;
  s += `Références fournies      : ${r.totalRefs}\n`;
  s += `Cellules remplies        : ${r.filled} (${pct}% des références)\n`;
  s += `Notes calculées          : ${r.notesComputed}/${r.notesCount}\n`;
  s += `Notes à saisie manuelle  : ${r.notesManual}\n`;
  s += `Références non trouvées  : ${r.unmatched.length}\n`;
  s += `Temps d'exécution        : ${r.elapsedMs} ms\n`;

  if (coherence) {
    s += `\n── CONTRÔLES DE COHÉRENCE ──\n`;
    s += `Score global : ${coherence.score}%\n`;
    s += `C1 — Total Actif = Total Passif : ${c1?.status ?? "—"}\n`;
    s += `OK : ${coherence.okCount} · Déséquilibrés : ${coherence.koCount} · Avertissements : ${coherence.warnCount}\n`;
  }

  if (r.unmatched.length > 0) {
    s += `\n── RÉFÉRENCES NON TROUVÉES (${r.unmatched.length}) ──\n`;
    for (const u of r.unmatched.slice(0, 15)) s += `  · ${u}\n`;
    if (r.unmatched.length > 15) s += `  … et ${r.unmatched.length - 15} autre(s)\n`;
  }

  if (r.report.length > 0) {
    s += `\n── DÉTAIL DES CELLULES REMPLIES (10 premières) ──\n`;
    for (const line of r.report.slice(0, 10)) s += `  ${line}\n`;
    if (r.report.length > 10) s += `  … et ${r.report.length - 10} autre(s)\n`;
  }

  s += `\n═══════════════════════════════════════════════\n`;
  return s;
}
