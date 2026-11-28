// ============================================================================
// FIMAAC — Chaînage de contrôle du journal d'audit
//
// Le produit annonce un « journal d'audit inviolable ». Tant que les traces
// vivent dans le localStorage, aucune inviolabilité n'est possible : un
// utilisateur peut éditer le JSON. En revanche, **l'altération peut être
// rendue détectable** — c'est la seule promesse honnête en local.
//
// Chaque entrée est scellée : hash = SHA-256(prevHash | contenu canonique).
// Modifier, insérer ou retirer une entrée casse la chaîne à partir de ce point.
//
// Limites assumées (à ne jamais masquer) :
//  - sans clé secrète ni horodatage externe, un attaquant qui recalcule TOUTE
//    la chaîne n'est pas détecté : ce n'est pas une preuve, c'est un contrôle ;
//  - l'inviolabilité réelle exige un ancrage serveur (P1 infrastructure).
// ============================================================================
import type { AuditLog } from "./types";

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

/**
 * SHA-256 synchrone (UTF-8). Implémenté ici pour ne dépendre d'aucune API
 * asynchrone et rester utilisable dans une mutation de store synchrone.
 * Vérifié contre les vecteurs officiels dans les tests.
 */
export function sha256(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const bitLen = bytes.length * 8;
  const withPadding = new Uint8Array((((bytes.length + 9) >> 6) + 1) << 6);
  withPadding.set(bytes);
  withPadding[bytes.length] = 0x80;
  const view = new DataView(withPadding.buffer);
  view.setUint32(withPadding.length - 4, bitLen >>> 0, false);
  view.setUint32(withPadding.length - 8, Math.floor(bitLen / 0x100000000), false);

  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Uint32Array(64);

  for (let offset = 0; offset < withPadding.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e;
      e = (d + t1) >>> 0;
      d = c; c = b; b = a;
      a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }

  return H.map((x) => x.toString(16).padStart(8, "0")).join("");
}

/** Racine de chaîne pour la première entrée. Constante explicite, jamais vide. */
export const GENESIS_HASH = "GENESIS";

/** Contenu canonique d'une entrée : tout ce qui doit être protégé contre l'édition. */
export function canonicalPayload(log: AuditLog, seq: number): string {
  return [
    seq,
    log.id,
    log.createdAt,
    log.userId,
    log.organizationId,
    log.action,
    log.entity,
    log.entityId,
    log.before ?? "",
    log.after ?? "",
    log.ip,
  ].join("|");
}

/** Scelle une entrée à la suite d'une chaîne existante. */
export function sealLog(log: AuditLog, previous: { seq: number; hash: string } | null): AuditLog {
  const seq = (previous?.seq ?? -1) + 1;
  const prevHash = previous?.hash ?? GENESIS_HASH;
  return { ...log, seq, prevHash, hash: sha256(`${prevHash}|${canonicalPayload(log, seq)}`) };
}

export interface ChainVerification {
  /** Vrai si aucune entrée scellée n'a été altérée ni déplacée. */
  ok: boolean;
  total: number;
  sealed: number;
  /** Entrées antérieures au chaînage (aucun hash) — signalées, pas accusées. */
  unsealed: number;
  /** Index (1-based, du plus ancien au plus récent) de la première rupture. */
  brokenAt: number | null;
  reason: string | null;
}

/**
 * Vérifie la chaîne. `logs` est attendu dans l'ordre du store (le plus récent
 * en tête) : la vérification remonte du plus ancien au plus récent.
 */
export function verifyAuditChain(logs: AuditLog[]): ChainVerification {
  const chronological = [...logs].reverse();
  let previous: { seq: number; hash: string } | null = null;
  let sealed = 0;
  let unsealed = 0;
  let brokenAt: number | null = null;
  let reason: string | null = null;

  for (let i = 0; i < chronological.length; i++) {
    const log = chronological[i];
    if (!log.hash || !log.prevHash || log.seq === undefined) {
      unsealed++;
      continue;
    }
    if (brokenAt !== null) continue;

    const chain: { seq: number; hash: string } | null = previous;
    const expectedSeq: number = (chain?.seq ?? -1) + 1;
    const expectedPrev: string = chain?.hash ?? GENESIS_HASH;
    if (log.seq !== expectedSeq) {
      brokenAt = i + 1;
      reason = `numéro de séquence inattendu (${log.seq} au lieu de ${expectedSeq}) — entrée insérée ou supprimée`;
      continue;
    }
    if (log.prevHash !== expectedPrev) {
      brokenAt = i + 1;
      reason = "maillon précédent incohérent — entrée insérée, retirée ou déplacée";
      continue;
    }
    if (log.hash !== sha256(`${log.prevHash}|${canonicalPayload(log, log.seq)}`)) {
      brokenAt = i + 1;
      reason = "empreinte différente du contenu — l'entrée a été modifiée après écriture";
      continue;
    }
    sealed++;
    previous = { seq: log.seq, hash: log.hash };
  }

  return {
    ok: brokenAt === null,
    total: chronological.length,
    sealed,
    unsealed,
    brokenAt,
    reason,
  };
}
