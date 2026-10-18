import path from "node:path";
import { readRange, statObject } from "@/engine/storage";

const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".webm": "video/webm", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".vtt": "text/vtt", ".m4a": "audio/mp4", ".mp3": "audio/mpeg" };
const CHUNK = 4 << 20;

/** Serves stored media with HTTP Range support so video can seek. */
export async function GET(req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const storageKey = key.map(decodeURIComponent).join("/");
  let size: number;
  try {
    size = (await statObject(storageKey)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const type = TYPES[path.extname(storageKey).toLowerCase()] ?? "application/octet-stream";
  const headers = { "content-type": type, "accept-ranges": "bytes", "cache-control": "public, max-age=31536000, immutable" };
  const range = req.headers.get("range");
  if (!range) return new Response(new Uint8Array(await readRange(storageKey, 0, size - 1)), { headers: { ...headers, "content-length": String(size) } });
  const m = range.match(/bytes=(\d*)-(\d*)/);
  const start = m?.[1] ? Number(m[1]) : 0;
  // Open-ended ranges are served in chunks; the browser asks for the rest.
  const end = Math.min(m?.[2] ? Number(m[2]) : start + CHUNK - 1, size - 1);
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
  const body = await readRange(storageKey, start, end);
  return new Response(new Uint8Array(body), { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(body.length) } });
}
