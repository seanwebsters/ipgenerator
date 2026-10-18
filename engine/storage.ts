import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { db } from "../lib/db";

/**
 * Object storage. Keys are S3-style paths, so another driver can implement
 * the same functions without touching callers. Two drivers ship:
 * - "fs": local filesystem under STORAGE_DIR (default ./storage/media).
 * - "db": bytes in Postgres (StoredBlob). The default on Vercel, whose disk
 *   doesn't persist, so a deployment needs nothing beyond its database.
 * STORAGE_DRIVER overrides the default.
 */
export interface StoredObject {
  key: string;
  bytes: number;
  checksum: string;
  mimeType: string;
}

export const storageDriver = (): "fs" | "db" => {
  const d = process.env.STORAGE_DRIVER;
  if (d === "fs" || d === "db") return d;
  return process.env.VERCEL ? "db" : "fs";
};

const ROOT = () => path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage", "media"));
/** Scratch space for the db driver: FFmpeg needs real files. */
const SCRATCH = () => path.join(tmpdir(), "webster");

function under(root: string, key: string): string {
  const p = path.resolve(root, key);
  if (!p.startsWith(root + path.sep)) throw new Error(`Invalid storage key: ${key}`);
  return p;
}

/** Filesystem driver only: where a key lives on disk. */
export function localPath(key: string): string {
  return under(ROOT(), key);
}

export async function putObject(key: string, body: Buffer, mimeType: string): Promise<StoredObject> {
  const checksum = createHash("sha256").update(body).digest("hex");
  if (storageDriver() === "db") {
    under(SCRATCH(), key); // same key validation as the filesystem driver
    const row = { data: new Uint8Array(body), mimeType, bytes: body.length, checksum };
    await db.storedBlob.upsert({ where: { key }, create: { key, ...row }, update: row });
  } else {
    const p = localPath(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, body);
  }
  return { key, bytes: body.length, checksum, mimeType };
}

export async function getObject(key: string): Promise<Buffer> {
  if (storageDriver() === "fs") return readFile(localPath(key));
  const row = await db.storedBlob.findUnique({ where: { key }, select: { data: true } });
  if (!row) throw new Error(`Object not found: ${key}`);
  return Buffer.from(row.data);
}

export async function statObject(key: string): Promise<{ size: number }> {
  if (storageDriver() === "fs") return stat(localPath(key));
  const row = await db.storedBlob.findUnique({ where: { key }, select: { bytes: true } });
  if (!row) throw new Error(`Object not found: ${key}`);
  return { size: row.bytes };
}

/** Bytes [start, end] inclusive, for HTTP Range requests. */
export async function readRange(key: string, start: number, end: number): Promise<Buffer> {
  if (storageDriver() === "fs") {
    const { open } = await import("node:fs/promises");
    const fh = await open(localPath(key), "r");
    try {
      const buf = Buffer.alloc(end - start + 1);
      const { bytesRead } = await fh.read(buf, 0, buf.length, start);
      return buf.subarray(0, bytesRead);
    } finally {
      await fh.close();
    }
  }
  const rows = await db.$queryRaw<{ part: Uint8Array }[]>`SELECT substring(data FROM ${start + 1}::int FOR ${end - start + 1}::int) AS part FROM "StoredBlob" WHERE key = ${key}`;
  if (!rows[0]) throw new Error(`Object not found: ${key}`);
  return Buffer.from(rows[0].part);
}

/**
 * A path on local disk holding the object, for tools like FFmpeg. The db
 * driver copies it into scratch space (reused within one instance).
 */
export async function localFile(key: string): Promise<string> {
  if (storageDriver() === "fs") return localPath(key);
  const p = under(SCRATCH(), key);
  if (!existsSync(p)) {
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, await getObject(key));
  }
  return p;
}

/** Directory for multi-file work (FFmpeg). Scratch only: store results with putObject. */
export async function workDir(key: string): Promise<string> {
  const p = storageDriver() === "fs" ? localPath(key) : under(SCRATCH(), key);
  await mkdir(p, { recursive: true });
  return p;
}

export const mediaUrl = (key: string) => `/api/media/${key.split("/").map(encodeURIComponent).join("/")}`;
