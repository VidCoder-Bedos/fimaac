/**
 * P27 — Le dossier actif : une seule clé, trois opérations.
 *
 * Avant : `fimaac_company` était écrit en dur dans **trois** fichiers
 * (`actions.ts` avec un setter, `AppLayout.tsx` avec une lecture directe,
 * `auth.ts` avec un `removeItem`), et le getter comme le clearer d'`actions.ts`
 * n'étaient appelés par personne. Trois copies d'une même clé, c'est trois
 * endroits qui peuvent diverger — et un dossier qui survit à une déconnexion si
 * l'un des trois oublie de nettoyer.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { COMPANY_SCOPE_KEY, getStoredCompanyId, storeCompanyId, clearStoredCompanyId } from "../companyScope";

const ROOT = resolve(__dirname, "../../..");
const SRC = join(ROOT, "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** Faux stockage : le comportement doit être le même que dans un navigateur. */
function installStorage(impl: { get?: (k: string) => string | null; set?: (k: string, v: string) => void; remove?: (k: string) => void } | null) {
  const g = globalThis as unknown as { localStorage?: unknown };
  if (impl === null) {
    delete g.localStorage;
    return;
  }
  g.localStorage = {
    getItem: impl.get ?? (() => null),
    setItem: impl.set ?? (() => undefined),
    removeItem: impl.remove ?? (() => undefined),
  };
}

describe("Dossier actif — lecture / écriture / oubli", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    installStorage({
      get: (k) => (store.has(k) ? store.get(k)! : null),
      set: (k, v) => { store.set(k, v); },
      remove: (k) => { store.delete(k); },
    });
  });
  afterEach(() => installStorage(null));

  it("mémorise puis relit le dossier, sous la clé unique", () => {
    expect(getStoredCompanyId()).toBeNull();
    storeCompanyId("c-42");
    expect(store.get(COMPANY_SCOPE_KEY)).toBe("c-42");
    expect(getStoredCompanyId()).toBe("c-42");
  });

  it("la déconnexion efface réellement le dossier actif", () => {
    storeCompanyId("c-42");
    clearStoredCompanyId();
    expect(getStoredCompanyId()).toBeNull();
  });

  it("un stockage indisponible ne casse jamais la session", () => {
    installStorage({
      get: () => { throw new Error("quota"); },
      set: () => { throw new Error("quota"); },
      remove: () => { throw new Error("quota"); },
    });
    expect(getStoredCompanyId()).toBeNull();
    expect(() => storeCompanyId("c-1")).not.toThrow();
    expect(() => clearStoredCompanyId()).not.toThrow();
  });

  it("un stockage absent (rendu serveur) ne casse rien non plus", () => {
    installStorage(null);
    expect(getStoredCompanyId()).toBeNull();
    expect(() => storeCompanyId("c-1")).not.toThrow();
    expect(() => clearStoredCompanyId()).not.toThrow();
  });
});

describe("Dossier actif — plus de copie de la clé", () => {
  it("la clé littérale n'apparaît que dans companyScope.ts", () => {
    const offenders = walk(SRC)
      .filter((f) => !f.endsWith("companyScope.ts") && !f.includes("__tests__"))
      .filter((f) => readFileSync(f, "utf8").includes('"fimaac_company"'))
      .map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it("les alias morts ne sont plus exportés par actions.ts", () => {
    const actions = readFileSync(join(SRC, "lib/actions.ts"), "utf8");
    for (const gone of ["addCompany", "addClientRequest", "createServiceRequest", "setServiceRequestStatus", "getCurrentCompany", "clearCurrentCompany"]) {
      expect(new RegExp(`export function ${gone}\\(`).test(actions), `${gone} est encore exporté`).toBe(false);
    }
    // Les fonctions réelles, elles, restent disponibles.
    expect(actions).toContain("export function createClientRequest(");
    expect(actions).toContain("export function addCompanyWithAccess(");
  });

  it("les helpers purement internes ne sont plus promis au reste du code", () => {
    const actions = readFileSync(join(SRC, "lib/actions.ts"), "utf8");
    for (const internal of ["currentUserId", "currentOrgId", "fiscalAdjustmentsFor", "updateFSSession"]) {
      expect(new RegExp(`export function ${internal}\\(`).test(actions), `${internal} est encore exporté`).toBe(false);
    }
  });
});
