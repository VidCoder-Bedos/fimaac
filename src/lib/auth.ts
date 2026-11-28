import { mutate, getDB, useDB } from "./store";
import { verifyPassword, hashPassword } from "./hash";
import { uid } from "./format";
import { clearStoredCompanyId } from "./companyScope";
import type { User, DBState } from "./types";

export interface AuthResult {
  ok: boolean;
  error?: string;
}

const AVATARS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function pushAudit(s: DBState, userId: string, orgId: string, action: string, entity: string, entityId: string, after: string) {
  s.auditLogs.unshift({
    id: uid(),
    userId,
    organizationId: orgId,
    action,
    entity,
    entityId,
    before: null,
    after,
    ip: "127.0.0.1",
    createdAt: new Date().toISOString(),
  });
}

/**
 * Connexion — SYNCHRONE : `hashPassword`/`verifyPassword` sont synchrones
 * (le seed appelle hashPassword() sans await).
 */
export function login(email: string, password: string): AuthResult {
  const s = getDB();
  const user = s.users.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.active,
  );
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { ok: false, error: "Adresse e-mail ou mot de passe incorrect." };
  }
  const targetId = user.id;
  const targetOrg = user.organizationId ?? "org-platform";
  mutate((st) => {
    const u = st.users.find((x) => x.id === targetId);
    if (u) u.lastLoginAt = new Date().toISOString();
    st.session.userId = targetId;
    pushAudit(st, targetId, targetOrg, "LOGIN", "Session", targetId, "Connexion réussie");
  });
  return { ok: true };
}

export function logout(): void {
  mutate((st) => {
    if (st.session.userId) {
      const u = st.users.find((x) => x.id === st.session.userId);
      pushAudit(st, st.session.userId, u?.organizationId || "org-platform", "LOGOUT", "Session", st.session.userId, "Déconnexion");
    }
    st.session.userId = null;
  });
  // P27 — une seule définition de la clé : le dossier actif ne survit pas à une
  // déconnexion (il pouvait sinon réapparaître chez l'utilisateur suivant).
  clearStoredCompanyId();
}

export interface CabinetRegisterInput {
  cabinetName: string;
  legalForm: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export function registerCabinet(input: CabinetRegisterInput): AuthResult {
  const s = getDB();
  if (s.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
    return { ok: false, error: "Un compte existe déjà avec cette adresse e-mail." };
  }
  if (input.password.length < 8) {
    return { ok: false, error: "Le mot de passe doit comporter au moins 8 caractères." };
  }
  const orgId = uid();
  const userId = uid();
  const passwordHash = hashPassword(input.password);
  const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
  const now = new Date().toISOString();

  mutate((st) => {
    st.organizations.push({
      id: orgId,
      name: input.cabinetName,
      type: "cabinet",
      legalForm: input.legalForm,
      email: input.email,
      country: "TG",
      city: "Lomé",
      logoColor: avatar,
      plan: "trial",
      createdAt: now,
    });
    st.subscriptions.push({
      id: uid(),
      organizationId: orgId,
      plan: "trial",
      status: "trialing",
      seats: 3,
      startedAt: now,
      renewsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      monthlyAmount: 0,
    });
    st.users.push({
      id: userId,
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: "cabinet_admin",
      userType: "cabinet",
      organizationId: orgId,
      companyId: null,
      avatarColor: avatar,
      twoFactorEnabled: false,
      mustChangePassword: false,
      active: true,
      createdAt: now,
      lastLoginAt: null,
    });
    st.session.userId = userId;
    pushAudit(st, userId, orgId, "REGISTER_CABINET", "Organization", orgId, `Création du cabinet ${input.cabinetName}`);
  });
  return { ok: true };
}

export interface ClientRegisterInput {
  companyName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  legalForm: string;
  /** LOT 4 — cabinet choisi par l'entreprise lors de l'inscription (obligatoire). */
  cabinetOrganizationId: string;
}

export function registerClient(input: ClientRegisterInput): AuthResult {
  const s = getDB();
  if (s.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
    return { ok: false, error: "Un compte existe déjà avec cette adresse e-mail." };
  }
  // LOT 4 — le cabinet choisi doit exister sur la plateforme
  const cabinet = s.organizations.find((o) => o.id === input.cabinetOrganizationId && o.type === "cabinet");
  if (!cabinet) return { ok: false, error: "Sélectionnez le cabinet qui gérera votre dossier." };
  if (input.password.length < 8) {
    return { ok: false, error: "Le mot de passe doit comporter au moins 8 caractères." };
  }
  const orgId = uid();
  const companyId = uid();
  const userId = uid();
  const passwordHash = hashPassword(input.password);
  const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
  const now = new Date().toISOString();
  const cabinetOrganizationId = input.cabinetOrganizationId;

  mutate((st) => {
    st.organizations.push({
      id: orgId,
      name: input.companyName,
      type: "company_client",
      legalForm: input.legalForm,
      email: input.email,
      country: "TG",
      city: "Lomé",
      logoColor: avatar,
      plan: "trial",
      createdAt: now,
    });
    st.companies.push({
      id: companyId,
      organizationId: orgId,
      name: input.companyName,
      legalForm: input.legalForm,
      nif: "À COMPLÉTER",
      sector: "À compléter",
      activity: "À compléter",
      city: "Lomé",
      capital: 0,
      taxRegime: "ri",
      vatPayer: false,
      currency: "XOF",
      fiscalYearStartMonth: 1,
      riskLevel: "low",
      cabinetOrganizationId,
      createdAt: now,
    });
    st.users.push({
      id: userId,
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: "client_admin",
      userType: "client",
      organizationId: orgId,
      companyId,
      avatarColor: avatar,
      twoFactorEnabled: false,
      mustChangePassword: false,
      active: true,
      createdAt: now,
      lastLoginAt: null,
    });
    // LOT 4 — notification au cabinet choisi : l'entreprise apparaît dans son portefeuille
    s.notifications.unshift({
      id: uid(),
      userId: null,
      organizationId: cabinetOrganizationId,
      title: `Nouvelle entreprise rattachée — ${input.companyName}`,
      body: `${input.firstName} ${input.lastName} a choisi votre cabinet lors de l'inscription.`,
      type: "info",
      read: false,
      createdAt: now,
    });
    st.session.userId = userId;
    pushAudit(st, userId, orgId, "REGISTER_CLIENT", "Organization", orgId, `Compte client créé — cabinet rattaché : ${cabinetOrganizationId}`);
  });
  return { ok: true };
}

export function currentUser(): User | null {
  const s = getDB();
  return s.users.find((u) => u.id === s.session.userId) || null;
}

export function useAuth(): { user: User | null } {
  const db = useDB();
  return { user: db.users.find((u) => u.id === db.session.userId) || null };
}
