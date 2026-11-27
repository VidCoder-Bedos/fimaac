import type { Permission, UserRole } from "./types";

export const ALL_PERMISSIONS: Permission[] = [
  "accounting.read",
  "accounting.create",
  "accounting.validate",
  "accounting.close",
  "tax.read",
  "tax.create",
  "tax.validate",
  "tax.submit",
  "documents.read",
  "documents.upload",
  "documents.delete",
  "reports.read",
  "reports.export",
  "users.manage",
  "settings.manage",
  "admin.platform",
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: ALL_PERMISSIONS,
  cabinet_admin: ALL_PERMISSIONS.filter((p) => p !== "admin.platform"),
  partner: [
    "accounting.read", "accounting.create", "accounting.validate", "accounting.close",
    "tax.read", "tax.create", "tax.validate", "tax.submit",
    "documents.read", "documents.upload", "documents.delete",
    "reports.read", "reports.export", "users.manage", "settings.manage",
  ],
  director: [
    "accounting.read", "accounting.create", "accounting.validate",
    "tax.read", "documents.read", "reports.read", "reports.export", "settings.manage",
  ],
  manager: [
    "accounting.read", "accounting.create", "accounting.validate",
    "tax.read", "tax.create",
    "documents.read", "documents.upload", "reports.read", "reports.export", "settings.manage",
  ],
  accountant: [
    "accounting.read", "accounting.create", "accounting.validate",
    "documents.read", "documents.upload",
    "reports.read", "reports.export", "tax.read",
  ],
  tax_specialist: [
    "tax.read", "tax.create", "tax.validate", "tax.submit",
    "accounting.read", "documents.read", "reports.read", "reports.export",
  ],
  payroll_manager: ["accounting.read", "documents.read", "reports.read"],
  assistant: ["accounting.read", "accounting.create", "documents.read", "documents.upload", "reports.read"],
  auditor: ["accounting.read", "tax.read", "documents.read", "reports.read", "reports.export"],
  client_admin: ["documents.read", "documents.upload", "reports.read"],
  client_accountant: ["documents.read", "documents.upload", "accounting.read"],
  client_user: ["documents.read", "documents.upload"],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Administrateur",
  cabinet_admin: "Administrateur cabinet",
  partner: "Associé",
  director: "Directeur",
  manager: "Chef de mission",
  accountant: "Comptable",
  tax_specialist: "Fiscaliste",
  payroll_manager: "Gestionnaire paie",
  assistant: "Assistant",
  auditor: "Auditeur",
  client_admin: "Administrateur client",
  client_accountant: "Comptable client",
  client_user: "Utilisateur client",
};

export function hasPermission(role: UserRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  if (role === "super_admin") return true;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
