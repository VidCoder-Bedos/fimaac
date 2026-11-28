// ============================================================================
// FIMAAC — Piège de focus des dialogues
//
// Une modale qui laisse Échap sans effet, qui n'annonce pas son rôle et d'où le
// clavier s'échappe dans la page en arrière-plan n'est pas une modale : c'est un
// panneau flottant. La logique de sélection est isolée ici pour être testable
// sans DOM.
// ============================================================================

/** Éléments réellement atteignables au clavier, dans l'ordre du document. */
export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Prochain index de focus dans un cycle fermé.
 * `count` = nombre d'éléments focusables, `current` = index courant
 * (-1 si le focus n'est pas encore dans le dialogue).
 */
export function nextFocusIndex(count: number, current: number, shift: boolean): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return shift ? count - 1 : 0;
  return shift ? (current - 1 + count) % count : (current + 1) % count;
}

/**
 * Deux cas où la touche Tab ne doit **pas** être interceptée : un seul élément
 * focusable (rien à faire tourner) et pas de dialogue (liste vide).
 */
export function shouldTrapKey(count: number, key: string): boolean {
  return count > 1 && key === "Tab";
}

/** Échappement : la touche qui ferme, sans dépendre de la disposition clavier. */
export function isEscapeKey(key: string, altKey = false, ctrlKey = false): boolean {
  return key === "Escape" || key === "Esc" || (key === "Escape" && (altKey || ctrlKey));
}

/**
 * Texte lu par le lecteur d'écran pour annoncer l'ouverture. Un titre vide ne
 * doit pas produire « , dialogue » : on retombe sur un libellé générique.
 */
export function dialogLabel(title?: string, fallback = "Dialogue"): string {
  const t = (title || "").trim();
  return t.length > 0 ? t : fallback;
}
