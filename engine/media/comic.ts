import sharp, { type OverlayOptions } from "sharp";

/**
 * Comic page compositor: lays out existing storyboard frames as a 2×3 grid
 * per page on paper stock, with caption boxes for action and dialogue.
 * Deterministic and local; reuses studio-owned art.
 */
export interface Panel {
  image: Buffer;
  caption: string; // action text or "NAME: line"
  isDialogue: boolean;
}

const W = 1200;
const H = 1800;
const MARGIN = 50;
const GUTTER = 28;
const COLS = 2;
const ROWS = 3;
const PANEL_W = (W - MARGIN * 2 - GUTTER * (COLS - 1)) / COLS; // 536
const PANEL_H = Math.round((PANEL_W * 9) / 16); // 302
const TEXT_H = 118;
const HEADER = 150;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

function wrap(text: string, max: number, lines: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/)) {
    if ((cur + " " + w).trim().length > max) {
      out.push(cur.trim());
      cur = w;
    } else cur += " " + w;
  }
  if (cur.trim()) out.push(cur.trim());
  if (out.length > lines) {
    out.length = lines;
    out[lines - 1] = out[lines - 1].replace(/\W*\w*$/, "") + "…";
  }
  return out;
}

export async function composePages(input: { title: string; subtitle: string; panels: Panel[] }): Promise<Buffer[]> {
  const perPage = COLS * ROWS;
  const pages: Buffer[] = [];
  for (let p = 0; p * perPage < input.panels.length; p++) {
    const slice = input.panels.slice(p * perPage, (p + 1) * perPage);
    const composites: OverlayOptions[] = [];
    const overlay: string[] = [];
    slice.forEach((panel, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = MARGIN + col * (PANEL_W + GUTTER);
      const y = HEADER + row * (PANEL_H + TEXT_H + GUTTER);
      composites.push({ input: panel.image, left: Math.round(x), top: Math.round(y) });
      overlay.push(`<rect x="${x}" y="${y}" width="${PANEL_W}" height="${PANEL_H}" fill="none" stroke="#14100c" stroke-width="5"/>`);
      const ty = y + PANEL_H + 12;
      const lines = wrap(panel.caption, 46, 3);
      if (panel.isDialogue) {
        const [speaker, ...rest] = panel.caption.split(": ");
        const body = wrap(rest.join(": "), 46, 3);
        overlay.push(`<rect x="${x}" y="${ty}" width="${PANEL_W}" height="${TEXT_H - 18}" rx="18" fill="#fffaf0" stroke="#14100c" stroke-width="3"/>`);
        overlay.push(`<text x="${x + 18}" y="${ty + 28}" font-family="DejaVu Sans, sans-serif" font-size="15" font-weight="700" letter-spacing="2" fill="#9a4a1c">${esc(speaker)}</text>`);
        body.forEach((l, j) => overlay.push(`<text x="${x + 18}" y="${ty + 54 + j * 22}" font-family="DejaVu Sans, sans-serif" font-size="19" fill="#14100c">${esc(l)}</text>`));
      } else {
        overlay.push(`<rect x="${x}" y="${ty}" width="${PANEL_W}" height="${TEXT_H - 18}" fill="#f2d98f" stroke="#14100c" stroke-width="3"/>`);
        lines.forEach((l, j) => overlay.push(`<text x="${x + 16}" y="${ty + 30 + j * 24}" font-family="DejaVu Serif, serif" font-size="18" font-style="italic" fill="#14100c">${esc(l)}</text>`));
      }
    });
    const header =
      p === 0
        ? `<text x="${W / 2}" y="78" text-anchor="middle" font-family="Liberation Serif, DejaVu Serif, serif" font-size="56" font-weight="700" letter-spacing="6" fill="#14100c">${esc(input.title.toUpperCase())}</text>
           <text x="${W / 2}" y="116" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="18" letter-spacing="4" fill="#6b5a46">${esc(input.subtitle.toUpperCase())}</text>`
        : `<text x="${W - MARGIN}" y="${H - 22}" text-anchor="end" font-family="DejaVu Sans, sans-serif" font-size="16" fill="#6b5a46">${p + 1}</text>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${header}${overlay.join("")}</svg>`;
    const page = await sharp({ create: { width: W, height: H, channels: 3, background: "#efe3cc" } })
      .composite([...composites, { input: Buffer.from(svg), left: 0, top: 0 }])
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    pages.push(page);
  }
  return pages;
}

export async function panelImage(png: Buffer): Promise<Buffer> {
  return sharp(png).resize(Math.round(PANEL_W), PANEL_H, { fit: "cover" }).png().toBuffer();
}
