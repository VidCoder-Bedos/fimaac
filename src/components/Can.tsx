import type { ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { hasPermission } from "../lib/permissions";
import type { Permission } from "../lib/types";

/**
 * M2 — Garde d'action RBAC.
 * Masque les actions sensibles pour les rôles qui n'en disposent pas.
 * Exemple : <Can permission="accounting.validate"><button>Valider</button></Can>
 * Les gardes de ROUTE restent dans App.tsx ; ceci complète au niveau ACTION.
 */
export function Can({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { user } = useAuth();
  if (!hasPermission(user?.role, permission)) return null;
  return <>{children}</>;
}
