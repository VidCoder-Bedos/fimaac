// ============================================================================
// FIMAAC — Production Engine : domain types (P0 fondation)
// Chaque zone a une définition (ZoneDef), chaque donnée un statut + confiance + sources.
// RÈGLE ABSOLUE : DataPoint.value = null signifie "INCONNU" — jamais 0 par défaut (§24).
// ============================================================================
import type { BalanceRow } from "../liasse";
import type { Account } from "../types";
import type { BilanResult, ResultatResult, TFTResult, Period as EnginePeriod, VariationResult } from "../engine/types";

/** Catégories de feuilles du classeur GUDEF. */
export type SheetCategory =
  | "IDENTIFICATION"
  | "BILAN_ACTIF"
  | "BILAN_PASSIF"
  | "RESULTAT"
  | "TFT"
  | "NOTE"
  | "FISCAL"
  | "ANNEXE"
  | "CONTROLE";

/** Nature fonctionnelle d'une zone (pas une coordonnée Excel — §14). */
export type ZoneKind = "input" | "calculated" | "derived" | "manual" | "control" | "title" | "total";

/** Période d'exercice concernée. */
export type Period = "N" | "N-1" | "both";

/** Définition d'une zone financière (matrice source → calcul → cellule → note → contrôle). */
export interface ZoneDef {
  /** Identifiant fonctionnel stable, ex: "bilan_actif.immo_incorporelles.net". */
  id: string;
  /** Feuille cible (libellé GUDEF). */
  sheet: string;
  /** Référence SYSCOHADA (AE, TA, RA…) si applicable. */
  ref?: string;
  label: string;
  category: SheetCategory;
  kind: ZoneKind;
  /** Clé dans RULE_REGISTRY (engine/agregateurs) si calculée par une règle factorisée. */
  ruleId?: string;
  /** Autres zones dont dépend celle-ci (graphe de dépendances, bonus 1). */
  deps?: string[];
  /** Note rattachée (NOTE_03A…) si la zone provient d'une note. */
  noteId?: string;
  /** Zone obligatoire pour la complétude (§19). */
  required: boolean;
  /** Seuil de matérialité (FCFA) au-delà duquel une variation déclenche une question (§21). */
  materiality?: number;
  period: Period;
}

/** Statut d'une donnée (§20). */
export type DataStatus =
  | "available"
  | "calculated"
  | "imported"
  | "provided"
  | "deduced"
  | "to_confirm"
  | "missing"
  | "not_applicable";

/** Source traçable d'un montant (§15, §16 : "d'où vient ce montant ?"). */
export interface TraceSource {
  kind: "account" | "balance" | "rule" | "note" | "entry" | "manual" | "document";
  /** code compte, id règle, id note, n° écriture… */
  ref: string;
  label?: string;
  amount?: number;
}

/** Une donnée produite : valeur + statut + confiance + sources (§20, §24, bonus 3). */
export interface DataPoint {
  zoneId: string;
  /** null = INCONNU (≠ 0). Règle absolue §24. */
  value: number | null;
  status: DataStatus;
  /** Niveau de confiance 0..100 (bonus 3 : 100 source / 95 calculé / 80 déduit / à confirmer). */
  confidence: number;
  sources: TraceSource[];
  note?: string;
  updatedAt: string;
}

/** Statut d'une question intelligente (§10). */
export type QuestionStatus = "pending" | "answered" | "skipped" | "resolved";

/** Question déduite des variations / données manquantes (§10, §26). */
export interface SmartQuestion {
  id: string;
  zoneId: string;
  category: string;
  prompt: string;
  /** Pourquoi la question est posée (variation X détectée, info manquante…). */
  reason: string;
  materiality: "high" | "medium" | "low";
  expectedType: "amount" | "boolean" | "text" | "date" | "choice";
  options?: string[];
  answer?: unknown;
  status: QuestionStatus;
}

/** Ligne d'une note annexe. */
/** P16 — Détail par compte d'une ligne de note (jamais agrégé en silence). */
export interface NoteDetail {
  code: string;
  label: string;
  n: number | null;
  n1: number | null;
}

export interface NoteRow {
  label: string;
  ref?: string;
  n: number | null;
  n1: number | null;
  variation?: number | null;
  /** Comptes qui composent la ligne : la somme des détails vaut la ligne. */
  details?: NoteDetail[];
}

/** Résultat du calcul d'une note (§8, §9). */
export interface NoteResult {
  code: string;
  applicable: boolean;
  rows: NoteRow[];
  totalN: number | null;
  totalN1: number | null;
  status: DataStatus;
  /** Réconciliation note ↔ état financier (§23). */
  reconciliation?: { targetZoneId: string; expected: number | null; actual: number | null; ecart: number; ok: boolean };
  missingInfo: string[];
}

/** Module de note indépendant (§9 : note par note). */
export interface NoteModule {
  code: string;
  title: string;
  /** La note est-elle applicable au contexte ? (§26 questionnaire adaptatif). */
  applicable: (ctx: ProdContext) => boolean;
  /** Autres notes/zones requises avant celle-ci (DAG). */
  dependencies: string[];
  compute: (ctx: ProdContext) => NoteResult;
  deriveQuestions: (ctx: ProdContext) => SmartQuestion[];
}

/** Score de complétude du dossier (§19). */
export interface CompletenessScore {
  pct: number;
  byCategory: Record<string, number>;
  /** Zones obligatoires toujours manquantes (bloquantes). */
  blockers: string[];
  label: "À démarrer" | "En cours" | "Prêt pour revue" | "Finalisé";
}

/** État d'une simulation non destructive (bonus 2). */
export interface SimulationState {
  hypotheses: { zoneId: string; delta: number; label: string }[];
  baseSnapshot: string;
}

/** Version immuable d'une session (§12 : jamais d'écrasement). */
export interface SessionVersion {
  id: string;
  createdAt: string;
  label: string;
  completenessPct: number;
  dataPoints: Record<string, DataPoint>;
}

/** Statut du workflow de production (§33). */
export type ProdStatus =
  | "imported"
  | "pre_generated"
  | "awaiting_answers"
  | "recalculated"
  | "controlled"
  | "validated"
  | "exported";

/** Contexte immuable passé à tous les modules du moteur de production. */
export interface ProdContext {
  companyName: string;
  exercise: string;
  balances: { n: BalanceRow[]; n1: BalanceRow[] };
  accounts: Account[];
  /** États factorisés (bilan/CR/TFT + variations) — reuse engine existant. */
  states: ProdStates;
  /** Données produites indexées par zoneId. */
  dataPoints: Map<string, DataPoint>;
  /** Notes 1-35. */
  notes: Map<string, NoteResult>;
  /** Options fiscales (réintégrations, déductions). */
  fiscalOpts: { reintegrations?: number; deductions?: number };
}

/** États financiers pré-calculés par le moteur factorisé (engine/etats.buildAllStates). */
export interface ProdStates {
  bilan: Record<EnginePeriod, BilanResult>;
  resultat: Record<EnginePeriod, ResultatResult>;
  tft: Record<EnginePeriod, TFTResult>;
  variations: Record<string, VariationResult>;
}

/** (Utilisé par P1+) — placeholder pour les futures sessions persistées. */
export interface ProductionSession {
  id: string;
  companyId: string;
  exercise: string;
  balances: { n: BalanceRow[]; n1: BalanceRow[] };
  dataPoints: Record<string, DataPoint>;
  notes: Record<string, NoteResult>;
  questions: SmartQuestion[];
  completeness: CompletenessScore;
  versions: SessionVersion[];
  simulation: SimulationState | null;
  status: ProdStatus;
  createdAt: string;
  updatedAt: string;
}
