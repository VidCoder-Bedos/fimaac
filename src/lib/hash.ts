// DEMO-GRADE password hashing (synchronous, browser-only — no backend available).
// IMPORTANT: In production FIMAAC this MUST run server-side (bcrypt/argon2) on NestJS.
// This is a deterministic salted hash sufficient for a local, single-user demo.

export function hashPassword(password: string): string {
  const salt = "fimaac::v1::0xa7";
  const input = `${salt}${password}${salt}`;
  let h1 = 0x811c9dc5 >>> 0;
  let h2 = 0x9e3779b9 >>> 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 2654435761) >>> 0;
  }
  let h = (h1 ^ (h2 << 7) ^ (h2 >>> 3)) >>> 0;
  for (let r = 0; r < 5; r++) {
    h = Math.imul(h ^ (h >>> 13), 0x85ebca6b) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
  }
  return "fh$" + h.toString(16).padStart(8, "0");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}
