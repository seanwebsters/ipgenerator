import path from "node:path";

/**
 * Hosts without system fonts (Vercel) render text with the DejaVu fonts in
 * assets/fonts. Pointing FONTCONFIG_FILE there covers both sharp's SVG text
 * and FFmpeg's burned-in captions (child processes inherit the env). Must run
 * before the first text render; render.ts, comic.ts and ffmpeg.ts import it.
 */
export const bundledFonts = () => process.env.WEBSTER_BUNDLED_FONTS === "1" || (!!process.env.VERCEL && process.env.WEBSTER_BUNDLED_FONTS !== "0");

if (bundledFonts() && !process.env.FONTCONFIG_FILE) {
  process.env.FONTCONFIG_FILE = path.join(process.cwd(), "assets", "fonts", "fonts.conf");
}
