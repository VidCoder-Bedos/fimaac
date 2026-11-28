// ============================================================================
// FIMAAC — Notifications non bloquantes
//
// `alert()` gelait l'interface, ne se fermait pas, ne se lisait pas par un
// lecteur d'écran (pas de région live) et ne laissait aucune trace : un
// « Dossier enregistré » ou un « Aucune société sélectionnée » disparaissait au
// clic suivant. Ce module est volontairement pur : il ne dépend ni de React ni
// du DOM, ce qui le rend testable et utilisable depuis n'importe quelle action.
// ============================================================================

export type ToastTone = "success" | "info" | "warning" | "danger";

export interface Toast {
  id: string;
  title: string;
  body?: string;
  tone: ToastTone;
  /** Nombre de fois que le même message a été demandé (fusion au lieu d'empilement). */
  count: number;
  /** Horodatage de création (ms). */
  createdAt: number;
  /** Durée de vie avant fermeture automatique. */
  durationMs: number;
}

/** Un écran ne doit pas disparaître sous une pile de messages identiques. */
export const MAX_TOASTS = 4;
export const DEFAULT_DURATION_MS = 6_000;

let seq = 0;
let toasts: Toast[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function reset() {
  seq = 0;
  toasts = [];
}

/** Pour les tests : remet le module à neuf sans toucher aux abonnés. */
export function resetToasts() {
  reset();
  emit();
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts(): Toast[] {
  return toasts;
}

/**
 * Déduit le ton d'un message quand l'appelant n'en fournit pas. Un refus n'a pas
 * la même couleur qu'une confirmation : l'utilisateur lit la couleur avant le
 * texte.
 */
export function toneForMessage(message: string): ToastTone {
  const m = message.toLowerCase();
  if (/erreur|impossible|refus|invalide|manquant|requis|obligatoire|sélectionnez|importez|introuvable|échou|aucun|aucune|non conforme|bloqu/.test(m)) return "danger";
  if (/attention|vérifiez|à vérifier|incohéren|écart|doublon|partiel|report/.test(m)) return "warning";
  if (/génér|enregistr|créé|créée|validé|validée|export|import|succès|mis à jour|envoyé|payé|terminé/.test(m)) return "success";
  return "info";
}

export function pushToast(input: {
  title: string;
  body?: string;
  tone?: ToastTone;
  durationMs?: number;
  now?: number;
}): Toast {
  const title = input.title.trim();
  const tone = input.tone ?? toneForMessage(title);
  const now = input.now ?? Date.now();
  const same = toasts.find((t) => t.title === title && t.body === input.body && t.tone === tone);
  if (same) {
    // Le message est répété : on compte au lieu d'empiler, et on relance le délai.
    same.count += 1;
    same.createdAt = now;
    toasts = [same, ...toasts.filter((t) => t.id !== same.id)];
    emit();
    return same;
  }
  const toast: Toast = {
    id: `toast-${++seq}`,
    title,
    body: input.body,
    tone,
    count: 1,
    createdAt: now,
    durationMs: input.durationMs ?? DEFAULT_DURATION_MS,
  };
  toasts = [toast, ...toasts].slice(0, MAX_TOASTS);
  emit();
  return toast;
}

export function dismissToast(id: string) {
  const before = toasts.length;
  toasts = toasts.filter((t) => t.id !== id);
  if (toasts.length !== before) emit();
}

/** Retire les messages échus — appelé par le rendu, jamais par un minuteur global. */
export function expireToasts(now: number): number {
  const before = toasts.length;
  toasts = toasts.filter((t) => now - t.createdAt < t.durationMs);
  if (toasts.length !== before) emit();
  return before - toasts.length;
}

/** Point d'entrée des écrans : `toast("Importez d'abord la balance N.")`. */
export function toast(title: string | undefined | null, body?: string, tone?: ToastTone): Toast {
  // Un refus peut arriver sans message (`error?: string`) : mieux vaut un texte
  // générique qu'une notification vide — ou un plantage.
  const text = (title || "").trim();
  return pushToast({ title: text.length > 0 ? text : "Action impossible", body, tone });
}

export function toastSuccess(title: string, body?: string) {
  return pushToast({ title, body, tone: "success" });
}

export function toastError(title: string, body?: string) {
  return pushToast({ title, body, tone: "danger" });
}
