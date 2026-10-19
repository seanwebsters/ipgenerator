import "./fonts";
import sharp from "sharp";
import { seeded } from "../../lib/util";

/**
 * Studio procedural renderer ("studio-procedural"). A deterministic, local,
 * non-AI illustrator: it composes scenes as SVG from the franchise palette,
 * canon cast colours and the shot description, then rasterises with sharp.
 * Used for storyboards and key art when no image provider is connected,
 * and always labelled as procedural in asset provenance.
 */

export interface CastMember {
  name: string;
  color: string;
}

export interface SceneSpec {
  seed: string;
  width: number;
  height: number;
  palette: string[];
  cast: CastMember[];
  /** wide | medium | close | establishing */
  framing: string;
  timeOfDay?: "night" | "dusk" | "day";
  title?: string;
  tagline?: string;
  slug?: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

function shade(hex: string, amt: number) {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, "0")).join("")}`;
}

function ridge(r: ReturnType<typeof seeded>, w: number, h: number, base: number, amp: number, steps: number) {
  const pts: string[] = [`M0,${h}`, `L0,${base}`];
  let y = base;
  for (let i = 1; i <= steps; i++) {
    const x = (i / steps) * w;
    y = Math.max(base - amp, Math.min(base + amp * 0.4, y + (r.next() - 0.5) * amp * 0.9));
    const cx = x - w / steps / 2;
    pts.push(`Q${cx.toFixed(1)},${(y - amp * 0.3 * r.next()).toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`);
  }
  pts.push(`L${w},${h}Z`);
  return pts.join(" ");
}

function figure(c: CastMember, x: number, groundY: number, scale: number, r: ReturnType<typeof seeded>) {
  const h = 150 * scale * (0.8 + r.next() * 0.45);
  const w = h * (0.42 + r.next() * 0.18);
  const head = w * (0.55 + r.next() * 0.15);
  const top = groundY - h;
  const ears = r.next() > 0.5;
  const dark = shade(c.color, -0.35);
  return `
    <g>
      <ellipse cx="${x}" cy="${groundY + 4}" rx="${w * 0.7}" ry="${6 * scale}" fill="#000" opacity="0.35"/>
      <rect x="${x - w / 2}" y="${top + head * 0.6}" width="${w}" height="${h - head * 0.6}" rx="${w / 2}" fill="url(#body-${esc(c.name).replace(/\W/g, "")})"/>
      ${ears ? `<path d="M${x - head * 0.42},${top + head * 0.3} l${-head * 0.12},${-head * 0.55} l${head * 0.34},${head * 0.3}Z M${x + head * 0.42},${top + head * 0.3} l${head * 0.12},${-head * 0.55} l${-head * 0.34},${head * 0.3}Z" fill="${dark}"/>` : ""}
      <circle cx="${x}" cy="${top + head * 0.5}" r="${head / 2}" fill="${c.color}"/>
      <circle cx="${x - head * 0.16}" cy="${top + head * 0.48}" r="${head * 0.07}" fill="#fff8e7"/>
      <circle cx="${x + head * 0.16}" cy="${top + head * 0.48}" r="${head * 0.07}" fill="#fff8e7"/>
      <path d="M${x - w / 2},${top + head * 0.9} q${w / 2},${h * 0.08} ${w},0" stroke="${shade(c.color, 0.35)}" stroke-width="${3 * scale}" fill="none" opacity="0.7"/>
    </g>`;
}

export function sceneSvg(spec: SceneSpec): string {
  const { width: W, height: H } = spec;
  const r = seeded(spec.seed);
  const [p0 = "#1b1530", p1 = "#6b3fa0", p2 = "#f2b84b", p3 = "#9fd8c3"] = spec.palette;
  const tod = spec.timeOfDay ?? (r.next() > 0.35 ? "night" : "dusk");
  const sky0 = tod === "day" ? shade(p3, 0.2) : shade(p0, -0.4);
  const sky1 = tod === "day" ? shade(p1, 0.4) : p1;
  const scale = spec.framing === "close" ? 2.4 : spec.framing === "medium" ? 1.5 : spec.framing === "establishing" ? 0.55 : 0.95;
  const groundY = H * (spec.title ? 0.7 : spec.framing === "close" ? 1.08 : spec.framing === "establishing" ? 0.8 : 0.84);
  const orbX = W * (0.15 + r.next() * 0.7);
  const orbY = H * (0.16 + r.next() * 0.18);
  const orbR = Math.min(W, H) * (spec.framing === "establishing" ? 0.06 : 0.09);

  const stars = tod === "day" ? "" : Array.from({ length: 90 }, () => `<circle cx="${(r.next() * W).toFixed(0)}" cy="${(r.next() * H * 0.6).toFixed(0)}" r="${(r.next() * 1.6 + 0.2).toFixed(2)}" fill="#fff6e0" opacity="${(0.25 + r.next() * 0.6).toFixed(2)}"/>`).join("");
  const layers = [0, 1, 2]
    .map((i) => {
      const base = H * (0.52 + i * 0.1);
      const color = shade(i === 2 ? p0 : p1, -0.45 - i * 0.15);
      return `<path d="${ridge(r, W, H, base, H * (0.14 - i * 0.03), 7 + i * 3)}" fill="${color}" opacity="${0.92 + i * 0.03}"/>`;
    })
    .join("");

  const cast = spec.cast.slice(0, spec.framing === "close" ? 1 : spec.framing === "medium" ? 2 : 4);
  const gradients = spec.cast
    .map((c) => `<linearGradient id="body-${esc(c.name).replace(/\W/g, "")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.color}"/><stop offset="1" stop-color="${shade(c.color, -0.5)}"/></linearGradient>`)
    .join("");
  const figures = cast
    .map((c, i) => {
      const slot = cast.length === 1 ? 0.5 + (r.next() - 0.5) * 0.3 : 0.22 + (i / Math.max(1, cast.length - 1)) * 0.56;
      return figure(c, W * slot, groundY, scale, r);
    })
    .join("");

  const fireflies = Array.from({ length: 18 }, () => `<circle cx="${(r.next() * W).toFixed(0)}" cy="${(H * 0.45 + r.next() * H * 0.45).toFixed(0)}" r="${(1.5 + r.next() * 3).toFixed(1)}" fill="${p2}" opacity="${(0.3 + r.next() * 0.6).toFixed(2)}" filter="url(#soft)"/>`).join("");

  // Title band sits below the ground line; size shrinks to fit long titles.
  const titleSize = spec.title ? Math.round(Math.min(W / 11, (W * 0.88) / (spec.title.length * 0.72), H / 9)) : 0;
  const titleY = H * 0.84;
  const title = spec.title
    ? `<rect y="${groundY}" width="${W}" height="${H - groundY}" fill="url(#band)"/>
       <text x="${W / 2}" y="${titleY}" text-anchor="middle" font-family="Liberation Serif, DejaVu Serif, serif" font-size="${titleSize}" letter-spacing="${Math.round(titleSize / 12)}" fill="#fbf3e4" style="font-weight:700">${esc(spec.title.toUpperCase())}</text>
       ${spec.tagline ? `<text x="${W / 2}" y="${titleY + titleSize * 0.75}" text-anchor="middle" font-family="Inter, DejaVu Sans, sans-serif" font-size="${Math.round(Math.max(14, titleSize / 3.4))}" letter-spacing="2" fill="#fbf3e4" opacity="0.85">${esc(spec.tagline)}</text>` : ""}`
    : "";
  const slug = spec.slug
    ? `<text x="${W * 0.03}" y="${H * 0.07}" font-family="Inter, DejaVu Sans, sans-serif" font-size="${Math.round(H / 34)}" letter-spacing="3" fill="#fbf3e4" opacity="0.7">${esc(spec.slug.toUpperCase())}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky0}"/><stop offset="0.7" stop-color="${sky1}"/><stop offset="1" stop-color="${shade(p2, -0.1)}"/></linearGradient>
    <radialGradient id="orb"><stop offset="0" stop-color="#fff7e2"/><stop offset="0.45" stop-color="${p2}"/><stop offset="1" stop-color="${p2}" stop-opacity="0"/></radialGradient>
    <radialGradient id="vig" cx="0.5" cy="0.45" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.75"/></radialGradient>
    <linearGradient id="band" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0907" stop-opacity="0"/><stop offset="0.35" stop-color="#0b0907" stop-opacity="0.85"/><stop offset="1" stop-color="#0b0907"/></linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="2"/></filter>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${r.int(1, 999)}"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 0.95  0 0 0 0 0.85  0 0 0 0.07 0"/></filter>
    ${gradients}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${stars}
  <circle cx="${orbX}" cy="${orbY}" r="${orbR * 3}" fill="url(#orb)" opacity="0.55"/>
  <circle cx="${orbX}" cy="${orbY}" r="${orbR}" fill="${p2}"/>
  ${layers}
  <rect y="${groundY}" width="${W}" height="${H - groundY}" fill="${shade(p0, -0.7)}"/>
  ${figures}
  ${fireflies}
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  <rect width="${W}" height="${H}" filter="url(#grain)"/>
  ${title}
  ${slug}
</svg>`;
}

export async function renderPng(spec: SceneSpec): Promise<Buffer> {
  return sharp(Buffer.from(sceneSvg(spec))).png({ compressionLevel: 8 }).toBuffer();
}

export async function toJpeg(png: Buffer, width?: number): Promise<Buffer> {
  const img = sharp(png);
  return (width ? img.resize({ width }) : img).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
}
