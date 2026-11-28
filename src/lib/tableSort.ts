// ============================================================================
// FIMAAC — Tri des tableaux, accessible et prévisible (P30)
//
// Constat d'audit (§D, point 12) : les tableaux ne se triaient pas au clavier —
// la plupart ne se triaient pas du tout, et les en-têtes n'exposaient aucun état
// (`aria-sort`). Sur une balance de plusieurs centaines de lignes, cela obligeait
// à trier « à l'œil » ou à exporter vers un tableur.
//
// Ici : une logique pure, donc testable — ordre stable, nombres comparés comme
// des nombres, textes selon la locale française (accents et casse ignorés),
// valeurs vides toujours en fin de liste quel que soit le sens.
// ============================================================================

export type SortDirection = "asc" | "desc";
export type SortState = { key: string; direction: SortDirection } | null;

/** Bascule : colonne nouvelle → croissant, même colonne → décroissant, puis retour à l'ordre d'origine. */
export function toggleSort(current: SortState, key: string): SortState {
  if (!current || current.key !== key) return { key, direction: "asc" };
  if (current.direction === "asc") return { key, direction: "desc" };
  return null;
}

/** Valeur `aria-sort` correspondant à l'état, pour l'en-tête concerné. */
export function ariaSort(state: SortState, key: string): "ascending" | "descending" | "none" {
  if (!state || state.key !== key) return "none";
  return state.direction === "asc" ? "ascending" : "descending";
}

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

/** Une valeur « vide » ne se compare pas : elle passe à la fin, dans les deux sens. */
function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === "" ||
    (typeof value === "string" && value.trim() === "");
}

export function compareValues(a: unknown, b: unknown): number {
  const aBlank = isBlank(a);
  const bBlank = isBlank(b);
  if (aBlank && bBlank) return 0;
  if (aBlank) return 1;
  if (bBlank) return -1;

  if (typeof a === "number" && typeof b === "number") return a - b;

  const aNum = typeof a === "string" ? Number(a.replace(/\s/g, "").replace(",", ".")) : NaN;
  const bNum = typeof b === "string" ? Number(b.replace(/\s/g, "").replace(",", ".")) : NaN;
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && a !== "" && b !== "") return aNum - bNum;

  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return collator.compare(String(a), String(b));
}

/**
 * Trie sans jamais modifier l'entrée. L'ordre d'origine est conservé pour les
 * valeurs égales (tri stable), et les vides restent en fin de liste même en
 * décroissant — sinon la première ligne d'un tri descendant serait toujours une
 * ligne sans donnée.
 */
export function sortRows<T>(rows: readonly T[], state: SortState, valueOf: (row: T, key: string) => unknown): T[] {
  if (!state) return [...rows];
  const factor = state.direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const a = valueOf(left.row, state.key);
      const b = valueOf(right.row, state.key);
      // Les vides ne changent jamais de camp, quel que soit le sens demandé.
      if (isBlank(a) && !isBlank(b)) return 1;
      if (!isBlank(a) && isBlank(b)) return -1;
      const diff = compareValues(a, b) * factor;
      return diff !== 0 ? diff : left.index - right.index;
    })
    .map((x) => x.row);
}
