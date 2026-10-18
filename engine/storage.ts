import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Object storage. Phase 1 ships the local-filesystem driver (STORAGE_DIR,
 * default ./storage/media). Keys are S3-style paths so an S3/R2 driver can
 * implement the same three functions without touching callers.
 */
export interface StoredObject {
  key: string;
  bytes: number;
  checksum: string;
  mimeType: string;
}

const ROOT = () => path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage", "media"));

export function localPath(key: string): string {
  const p = path.resolve(ROOT(), key);
  if (!p.startsWith(ROOT() + path.sep)) throw new Error(`Invalid storage key: ${key}`);
  return p;
}

export async function putObject(key: string, body: Buffer, mimeType: string): Promise<StoredObject> {
  const p = localPath(key);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, body);
  return { key, bytes: body.length, checksum: createHash("sha256").update(body).digest("hex"), mimeType };
}

export async function getObject(key: string): Promise<Buffer> {
  return readFile(localPath(key));
}

export async function statObject(key: string) {
  return stat(localPath(key));
}

/** Directory for multi-file work (FFmpeg). */
export async function workDir(key: string): Promise<string> {
  const p = localPath(key);
  await mkdir(p, { recursive: true });
  return p;
}

export const mediaUrl = (key: string) => `/api/media/${key.split("/").map(encodeURIComponent).join("/")}`;
