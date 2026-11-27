import type { DBState, User } from "./types";
/**
 * Lot 1 — Sélecteur de périmètre PARTAGÉ.
 * Remplace les 9 implémentations dupliquées du filtre
 * `organizationId === user.organizationId` (Dashboard, Companies, GlobalSearch,
 * AppLayout, ConformityWorkshop, AIAssistant, Obligations, StatementsWorkshop,
 * AdminPages) qui ne connaissaient pas la liaison cabinet ↔ entreprise.
 *
 * Périmètre :
 * - cabinet (ou tout user d'un cabinet) : les entreprises qui lui sont RATTACHÉES
 *   via Company.cabinetOrganizationId ;
 * - client : uniquement sa propre entreprise (User.companyId) ;
 * - super_admin : toutes.
 */
export function companiesForUser(db: DBState, user: User | null | undefined) {
  if (!user) return [];
  if (user.role === "super_admin") return db.companies;
  if (user.userType === "client") {
    return db.companies.filter((c) => c.id === user.companyId);
  }
  // cabinet / admin de cabinet — la liaison est la source de vérité
  return db.companies.filter((c) => c.cabinetOrganizationId === user.organizationId);
}

/** Une entreprise est-elle gérée par ce cabinet ? */
export function isManagedBy(company: { cabinetOrganizationId: string | null }, organizationId: string | null | undefined): boolean {
  return !!organizationId && company.cabinetOrganizationId === organizationId;
}

/** L'utilisateur peut-il consulter cette entreprise ? */
export function canAccessCompany(db: DBState, user: User | null | undefined, companyId: string): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  const c = db.companies.find((x) => x.id === companyId);
  if (!c) return false;
  if (user.userType === "client") return c.id === user.companyId;
  return isManagedBy(c, user.organizationId);
}
