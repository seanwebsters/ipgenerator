import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Secrets are encrypted with AES-256-GCM. The key comes from WEBSTER_SECRET_KEY
 * (32 bytes, base64). In development a key is generated once into
 * storage/.dev-secret-key so the app works out of the box; production refuses
 * to start without an explicit key.
 */
let ephemeralKey: Buffer | undefined;

function masterKey(): Buffer {
  const env = process.env.WEBSTER_SECRET_KEY;
  if (env) {
    const key = Buffer.from(env, "base64");
    if (key.length !== 32) throw new Error("WEBSTER_SECRET_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32).");
    return key;
  }
  // The built-in database (no DATABASE_URL) lives only as long as the process,
  // so a per-process key is enough for the secrets stored in it.
  if (!process.env.DATABASE_URL) return (ephemeralKey ??= randomBytes(32));
  if (process.env.NODE_ENV === "production") throw new Error("WEBSTER_SECRET_KEY is required in production.");
  const file = path.join(process.cwd(), "storage", ".dev-secret-key");
  if (!existsSync(file)) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, randomBytes(32).toString("base64"), { mode: 0o600 });
  }
  return Buffer.from(readFileSync(file, "utf8").trim(), "base64");
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}

export function decryptSecret(rec: { ciphertext: string; iv: string; tag: string }): string {
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(rec.iv, "base64"));
  decipher.setAuthTag(Buffer.from(rec.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(rec.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(expected, actual);
}

export const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
