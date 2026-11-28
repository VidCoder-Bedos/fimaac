// ============================================================================
// FIMAAC — Clients et fournisseurs non affectés
//
// Le contrôle du FEC signalait déjà « 62 lignes de tiers sans auxiliaire » sur
// le dossier de démonstration. Mais aucune action ne permettait de corriger :
// le contrôle était vrai et inutile. Ce module prépare la liste à traiter et
// son regroupement, pour que la correction se fasse en un clic par compte.
// ============================================================================

import type { JournalEntry, ThirdParty } from "./types";

/** Compte de tiers : 40x (fournisseurs) ou 41x (clients), comme dans le FEC. */
export function isThirdPartyAccount(accountCode: string): boolean {
  return /^(40|41)/.test(String(accountCode ?? ""));
}

/** Nature attendue du tiers d'après le compte collectif. */
export function expectedTierType(accountCode: string): "customer" | "supplier" | null {
  const code = String(accountCode ?? "");
  if (code.startsWith("40")) return "supplier";
  if (code.startsWith("41")) return "customer";
  return null;
}

/** Collectif à trois chiffres : 4011 et 4012 partagent 401. */
export function collectiveOf(accountCode: string): string {
  return String(accountCode ?? "").slice(0, 3);
}

export interface MissingTierLine {
  entryId: string;
  entryNumber: string;
  date: string;
  accountId: string;
  lineIndex: number;
  label: string;
  /** Débit − crédit : le sens suffit à savoir si le tiers doit être client ou fournisseur. */
  amount: number;
}

export interface MissingTierGroup {
  accountId: string;
  collective: string;
  expectedType: "customer" | "supplier" | null;
  lines: MissingTierLine[];
  /** Somme des valeurs absolues, pour mesurer l'enjeu du compte. */
  totalAmount: number;
}

/**
 * Lignes de comptes de tiers sans tiers identifié.
 * On ne regarde que les lignes : une écriture peut porter un tiers sur une ligne
 * et pas sur l'autre (écart de lettrage impossible à expliquer ensuite).
 */
export function missingThirdPartyLines(entries: JournalEntry[], companyId?: string): MissingTierLine[] {
  const out: MissingTierLine[] = [];
  for (const entry of entries) {
    if (companyId && entry.companyId !== companyId) continue;
    entry.lines.forEach((line, lineIndex) => {
      if (!isThirdPartyAccount(line.accountId)) return;
      if (line.thirdPartyId) return;
      // Une ligne entièrement nulle (contrepartie vide) n'a pas de tiers à porter.
      if (!line.debit && !line.credit) return;
      out.push({
        entryId: entry.id,
        entryNumber: entry.number,
        date: entry.date,
        accountId: line.accountId,
        lineIndex,
        label: line.label || entry.label,
        amount: (line.debit || 0) - (line.credit || 0),
      });
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.entryNumber.localeCompare(b.entryNumber));
}

/** Regroupement par compte collectif : c'est à ce niveau qu'on affecte. */
export function groupMissingTiers(lines: MissingTierLine[]): MissingTierGroup[] {
  const map = new Map<string, MissingTierGroup>();
  for (const l of lines) {
    const key = l.accountId;
    const group = map.get(key) || {
      accountId: key,
      collective: collectiveOf(key),
      expectedType: expectedTierType(key),
      lines: [],
      totalAmount: 0,
    };
    group.lines.push(l);
    group.totalAmount += Math.abs(l.amount);
    map.set(key, group);
  }
  return [...map.values()].sort((a, b) => b.lines.length - a.lines.length || a.accountId.localeCompare(b.accountId));
}

/**
 * Tiers proposables pour une ligne : ceux du bon collectif d'abord, puis ceux du
 * bon type. Un fournisseur n'a rien à faire sur un compte client — mais la liste
 * reste complète pour ne pas bloquer un cas limite.
 */
export function tiersForAccount(tiers: ThirdParty[], accountCode: string, companyId?: string): ThirdParty[] {
  const scoped = companyId ? tiers.filter((t) => t.companyId === companyId) : tiers;
  const collective = collectiveOf(accountCode);
  const expected = expectedTierType(accountCode);
  const rank = (t: ThirdParty) => {
    if (collectiveOf(t.collective || "") === collective) return 0;
    if (expected && t.type === expected) return 1;
    return 2;
  };
  return [...scoped].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** Résumé d'une affectation en masse, pour l'annoncer avant de l'exécuter. */
export function describeAssignment(group: MissingTierGroup, tier: ThirdParty): string {
  const n = group.lines.length;
  return `${n} ligne${n > 1 ? "s" : ""} du compte ${group.accountId} seront rattachées à ${tier.code} — ${tier.name}.`;
}
