// ============================================================================
// FIMAAC — Production Engine : score de complétude (P0, §19)
// Calcule "Dossier complété à X %" — pondéré par zones obligatoires, notes,
// contrôles et questions. Identifie les bloqueurs (zones manquantes critiques).
// ============================================================================
import type { CompletenessScore, ProdContext, SheetCategory } from "./types";
import { ZONE_REGISTRY, mandatoryZones, zonesByCategory } from "./zones";

/** Poids par défaut du score de complétude (configurable). */
export const COMPLETENESS_WEIGHTS = {
  zones: 0.5,       // zones obligatoires renseignées
  notes: 0.25,      // notes applicables complétées
  controls: 0.15,   // contrôles passants
  questions: 0.1,   // questions résolues
};

/** Seuils de libellé. */
const LABEL_THRESHOLDS = { started: 30, inProgress: 60, readyForReview: 95 } as const;

/** Contrôles optionnels portés par le contexte (P1). */
type CtxWithControls = ProdContext & { controls?: { ok: boolean }[]; questions?: { status: string }[] };

/**
 * Calcule le score de complétude d'un dossier de production.
 *
 * @param ctx     contexte (dataPoints, notes, etc.)
 * @param weights pondérations (défaut COMPLETENESS_WEIGHTS)
 * @returns CompletenessScore { pct, byCategory, blockers, label }
 */
export function computeCompleteness(
  ctx: ProdContext,
  weights = COMPLETENESS_WEIGHTS,
): CompletenessScore {
  const mandatory = mandatoryZones();
  const byCategory: Record<string, number> = {};

  // --- 1. Zones obligatoires renseignées ---
  let zonesFilled = 0;
  const blockers: string[] = [];
  for (const zone of mandatory) {
    const dp = ctx.dataPoints.get(zone.id);
    const filled = !!dp && dp.value !== null && dp.status !== "missing";
    if (filled) zonesFilled++;
    else blockers.push(zone.id);
    const cat = zone.category;
    byCategory[cat] = (byCategory[cat] || 0) + (filled ? 1 : 0);
  }
  const zoneScore = mandatory.length ? zonesFilled / mandatory.length : 1;

  // --- 2. Notes applicables complétées ---
  let applicableNotes = 0;
  let completedNotes = 0;
  for (const note of ctx.notes.values()) {
    if (!note.applicable) continue;
    applicableNotes++;
    if (note.status !== "missing" && note.totalN !== null) completedNotes++;
  }
  const noteScore = applicableNotes ? completedNotes / applicableNotes : 1;

  // --- 3. Contrôles passants (proxy : ctx.controls non rempli en P0 → neutre) ---
  const controls = (ctx as CtxWithControls).controls || [];
  const passingControls = controls.filter((c) => c.ok).length;
  const controlScore = controls.length ? passingControls / controls.length : 1;

  // --- 4. Questions résolues ---
  const questions = (ctx as CtxWithControls).questions || [];
  const resolvedQuestions = questions.filter(
    (q) => q.status === "answered" || q.status === "resolved" || q.status === "skipped",
  ).length;
  const questionScore = questions.length ? resolvedQuestions / questions.length : 1;

  // --- Score pondéré ---
  const pct = Math.round(
    (zoneScore * weights.zones + noteScore * weights.notes +
      controlScore * weights.controls + questionScore * weights.questions) * 100,
  );

  // --- Complétude par catégorie (normalisée) ---
  for (const cat of Object.keys(byCategory) as SheetCategory[]) {
    const total = zonesByCategory(cat).filter((z) => z.required && z.kind !== "title").length;
    byCategory[cat] = total ? Math.round((byCategory[cat] / total) * 100) : 0;
  }

  // --- Libellé ---
  let label: CompletenessScore["label"];
  if (pct >= LABEL_THRESHOLDS.readyForReview) label = "Finalisé";
  else if (pct >= LABEL_THRESHOLDS.inProgress) label = "Prêt pour revue";
  else if (pct >= LABEL_THRESHOLDS.started) label = "En cours";
  else label = "À démarrer";

  return { pct, byCategory, blockers, label };
}

/** Diagnostic rapide du registre (pour debug / UI). */
export function completenessReadout(ctx: ProdContext): string {
  const score = computeCompleteness(ctx);
  const filled = ZONE_REGISTRY.filter((z) => z.required && z.kind !== "title").length - score.blockers.length;
  return `Dossier à ${score.pct}% (${score.label}) — ${filled} zones renseignées, ${score.blockers.length} bloqueur(s)`;
}
