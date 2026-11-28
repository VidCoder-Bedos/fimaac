import { useSyncExternalStore } from "react";
import type { DBState, JournalEntry } from "./types";
import { seedDatabase } from "./seed";
import { measureSerialized, type StorageUsage } from "./storage";

/**
 * B1 — VERSIONNEMENT + MIGRATION du schéma persistant.
 * Toute évolution du modèle (champ ajouté, collection nouvelle) doit incrémenter
 * DB_VERSION et être traitée dans migrate(). Sinon, le visiteur récurrent charge
 * un état partiel et l'UI crashe (TypeError sur champ manquant).
 */
const DB_VERSION = 4;
const KEY = "fimaac_db_v1";

/** Lot 1 — DB_VERSION 3 : liaison cabinet ↔ entreprise.
 *  Champs ajoutés : Company.cabinetOrganizationId · User.mustChangePassword. */
/** P10 — DB_VERSION 4 : retraitements fiscaux persistés (réintégrations /
 *  déductions). Collection `taxAdjustments`, initialisée à vide ; aucune valeur
 *  n'est déduite d'un état antérieur. */
/** Collections ajoutées après le premier seed — initialisées à vide si absentes. */
const COLLECTION_KEYS = [
  "documents", "bankAccounts", "bankTransactions", "fixedAssets", "taxProfiles",
  "taxRules", "taxDeclarations", "taxDeadlines", "employees", "missions", "tasks",
  "notifications", "auditLogs", "conversations", "subscriptions", "invoices",
  "clientRequests", "complianceIssues", "documentRequests", "taxPaymentRequests",
  "entryTemplates", "stockItems", "payslips", "reconRules", "permanentDocs",
  "tiers", "fsSessions", "regulatoryVersions", "taxRulesV2", "taxBrackets",
  "socialRules", "declarationTemplates", "payrollComponents", "declarationWorkflows",
  "taxAdjustments",
] as const;

/**
 * Normalise un état issu d'une version antérieure : comble les champs et
 * collections ajoutés après coup. Idempotent — un état à jour passe inchangé.
 * Règle de sécurité : toute collection manquante est initialisée à vide,
 * jamais à une valeur déduite.
 */
function migrate(parsed: Record<string, unknown>): DBState {
  const s = parsed as Partial<DBState> & Record<string, unknown>;

  for (const k of COLLECTION_KEYS) {
    if (!Array.isArray(s[k])) s[k] = [];
  }
  if (!Array.isArray(s.journals)) s.journals = [];
  if (!Array.isArray(s.fiscalYears)) s.fiscalYears = [];
  if (!Array.isArray(s.periods)) s.periods = [];
  if (!Array.isArray(s.entries)) s.entries = [];
  if (!s.session || typeof s.session !== "object") s.session = { userId: null };
  if (!s.payrollConfig || typeof s.payrollConfig !== "object") {
    s.payrollConfig = seedDatabase().payrollConfig;
  }

  // B1 — `JournalEntry.attachmentDocIds` ajouté au lot OCR : absent des états v1.
  for (const e of s.entries as JournalEntry[]) {
    if (!Array.isArray(e.attachmentDocIds)) e.attachmentDocIds = [];
  }

  // Lot 1 — backfill de la liaison cabinet ↔ entreprise : toute entreprise dont
  // l'organisation propriétaire est un cabinet lui est rattachée (couvre le seed
  // co-demo / co-demo-2). Les entreprises sans org connue restent à null.
  const orgType = new Map<string, string>();
  for (const o of (s.organizations || []) as { id: string; type: string }[]) {
    orgType.set(o.id, o.type);
  }
  for (const c of (s.companies || []) as { id: string; organizationId: string; cabinetOrganizationId?: string | null }[]) {
    if (c.cabinetOrganizationId === undefined) {
      c.cabinetOrganizationId = orgType.get(c.organizationId) === "cabinet" ? c.organizationId : null;
    }
  }
  // Lot 1 — `mustChangePassword` : absent des états antérieurs → false (les comptes
  // existants ne sont pas forcés à changer ; seuls les identifiants GÉNÉRÉS le seront).
  for (const u of (s.users || []) as { mustChangePassword?: boolean }[]) {
    if (typeof u.mustChangePassword !== "boolean") u.mustChangePassword = false;
  }

  s.version = DB_VERSION;
  s.booted = true;
  return s as DBState;
}

function load(): DBState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DBState & { version?: number };
      if (parsed && parsed.booted) {
        try {
          // État d'une version antérieure → migration normalisante.
          // Si la migration échoue (état illisible) → re-seed propre ci-dessous.
          return parsed.version === DB_VERSION
            ? parsed
            : migrate(parsed as unknown as Record<string, unknown>);
        } catch {
          /* état corrompu → re-seed */
        }
      }
    }
  } catch {
    /* localStorage indisponible ou JSON invalide */
  }
  const fresh = seedDatabase();
  try {
    localStorage.setItem(KEY, JSON.stringify(fresh));
  } catch {
    /* quota dépassé — l'application fonctionne en mémoire pour la session */
  }
  return fresh;
}

let state: DBState = load();
const listeners = new Set<() => void>();

export function getDB(): DBState {
  return state;
}

/**
 * P0-5 — l'échec d'écriture n'est plus avalé.
 * Avant : le bloc `catch` de `persist` ne faisait rien du tout. L'application
 * continuait d'afficher un
 * dossier qui n'était plus sauvegardé nulle part, et l'utilisateur le perdait
 * au rechargement sans avoir été prévenu une seule fois.
 */
let persistError: string | null = null;
let lastPersistedAt: string | null = null;

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    persistError = null;
    lastPersistedAt = new Date().toISOString();
  } catch (e) {
    const err = e as { name?: string; message?: string };
    persistError =
      err?.name === "QuotaExceededError" || /quota/i.test(err?.message || "")
        ? "quota de stockage du navigateur dépassé"
        : err?.message || String(e);
  }
}

/** Clé de stockage, exposée pour la sauvegarde/restauration et les tests. */
export const STORAGE_KEY = KEY;

/** Occupation réelle du stockage + état de la dernière écriture (P0-5). */
export function storageSnapshot(): {
  usage: StorageUsage;
  persistError: string | null;
  lastPersistedAt: string | null;
} {
  return { usage: measureSerialized(JSON.stringify(state)), persistError, lastPersistedAt };
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * B2 — File de mutations sérialisée.
 * Chaque mutation clone l'état AU MOMENT OÙ ELLE S'EXÉCUTE (et non au moment de
 * l'appel) : deux mutations rapprochées ne peuvent plus s'écraser mutuellement
 * (bug TOCTOU du pattern « read-then-clone »).
 */
let chain: Promise<void> = Promise.resolve();

export function mutate(fn: (s: DBState) => void): void {
  chain = chain
    .then(() => {
      const next: DBState = structuredClone(state);
      fn(next);
      state = next;
      persist();
      listeners.forEach((l) => l());
    })
    .catch((err) => {
      // Une mutation qui échoue ne casse jamais la file ni les suivantes.
      console.error("[FIMAAC] mutation échouée :", err);
    });
}

/**
 * m13 — Détection de conflit multi-onglets.
 * Un second onglet qui écrit prévient les autres : l'état est rechargé et les
 * vues se mettent à jour (au lieu du « dernier écrivain gagne » silencieux).
 */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      const incoming = JSON.parse(e.newValue) as DBState;
      if (incoming?.booted && incoming.version === DB_VERSION) {
        state = incoming;
        listeners.forEach((l) => l());
      }
    } catch {
      /* événement storage illisible — ignoré */
    }
  });
}

export function resetDB(): void {
  state = seedDatabase();
  persist();
  listeners.forEach((l) => l());
}

export function exportDB(): string {
  return JSON.stringify(state, null, 2);
}

export function importDB(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as DBState & { version?: number };
    if (!parsed || !parsed.booted) return false;
    state = parsed.version === DB_VERSION
      ? parsed
      : migrate(parsed as unknown as Record<string, unknown>);
    persist();
    listeners.forEach((l) => l());
    return true;
  } catch {
    return false;
  }
}

export function useDB(): DBState {
  return useSyncExternalStore(subscribe, getDB, getDB);
}
