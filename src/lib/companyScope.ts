// ============================================================================
// FIMAAC — Clé de persistance du dossier actif (P27)
//
// Constat : la clé `fimaac_company` était écrite **en dur dans trois fichiers**
// (`actions.ts` avec un setter, `AppLayout.tsx` avec une lecture directe,
// `auth.ts` avec un `removeItem`), et le getter comme le clearer de `actions.ts`
// n'étaient appelés nulle part. Trois copies d'une même clé, c'est trois endroits
// qui peuvent diverger — et un dossier sélectionné qui survit à une déconnexion
// si l'un des trois oublie de nettoyer.
//
// Ici : une seule définition, trois opérations, et un accès qui ne casse pas
// quand le stockage est indisponible (navigation privée, quota plein).
// ============================================================================

export const COMPANY_SCOPE_KEY = "fimaac_company";

/** Dossier actif mémorisé, ou `null` si aucun (ou stockage indisponible). */
export function getStoredCompanyId(): string | null {
  try {
    return localStorage.getItem(COMPANY_SCOPE_KEY);
  } catch {
    return null;
  }
}

/** Mémorise le dossier actif. Silencieux si le stockage refuse : la session reste utilisable. */
export function storeCompanyId(companyId: string): void {
  try {
    localStorage.setItem(COMPANY_SCOPE_KEY, companyId);
  } catch { /* stockage indisponible */ }
}

/** Oublie le dossier actif — à la déconnexion, jamais à la navigation. */
export function clearStoredCompanyId(): void {
  try {
    localStorage.removeItem(COMPANY_SCOPE_KEY);
  } catch { /* stockage indisponible */ }
}
