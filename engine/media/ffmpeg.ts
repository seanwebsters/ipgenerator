import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { seeded } from "../../lib/util";

const run = promisify(execFile);
const FFMPEG = () => process.env.FFMPEG_PATH ?? "ffmpeg";
const FFPROBE = () => process.env.FFPROBE_PATH ?? "ffprobe";

export interface Shot {
  image: string; // absolute path to a PNG
  durationSec: number;
}

export interface Cue {
  start: number;
  end: number;
  text: string;
}

const ts = (s: number, sep: "," | ".") => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}${sep}${String(ms % 1000).padStart(3, "0")}`;
};

export const toSrt = (cues: Cue[]) => cues.map((c, i) => `${i + 1}\n${ts(c.start, ",")} --> ${ts(c.end, ",")}\n${c.text}\n`).join("\n");
export const toVtt = (cues: Cue[]) => `WEBVTT\n\n${cues.map((c) => `${ts(c.start, ".")} --> ${ts(c.end, ".")}\n${c.text}\n`).join("\n")}`;

export async function ffmpegAvailable(): Promise<string | null> {
  try {
    const { stdout } = await run(FFMPEG(), ["-hide_banner", "-version"]);
    return stdout.split("\n")[0];
  } catch {
    return null;
  }
}

/**
 * Procedural temp score: a slow four-chord pad (sine partials with a gentle
 * tremolo), synthesised by FFmpeg. Labelled as a temp score in provenance.
 */
export async function tempScore(out: string, durationSec: number, seed: string) {
  const r = seeded(seed);
  const roots = [220, 196, 174.61, 246.94, 164.81, 261.63];
  const prog = Array.from({ length: 4 }, () => r.pick(roots));
  const chord = (f: number) => `(sin(2*PI*${f}*t)+0.6*sin(2*PI*${(f * 1.26).toFixed(2)}*t)+0.5*sin(2*PI*${(f * 1.5).toFixed(2)}*t)+0.3*sin(2*PI*${(f / 2).toFixed(2)}*t))`;
  const seg = 4;
  const expr = prog.map((f, i) => `if(eq(mod(floor(t/${seg}),4),${i}),${chord(f)},0)`).join("+");
  const env = `0.07*(0.85+0.15*sin(2*PI*0.25*t))`;
  await run(FFMPEG(), [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", `aevalsrc='${env}*(${expr})':s=44100:d=${durationSec.toFixed(2)}`,
    "-af", `lowpass=f=1800,afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, durationSec - 2).toFixed(2)}:d=2`,
    "-ac", "2", out,
  ]);
}

/**
 * Assemble an animatic: each storyboard frame gets a slow push-in, frames
 * crossfade, captions are burned in, and the audio bed (narration or temp
 * score) is mixed under. Output: H.264/AAC MP4, 1280x720, 25fps, faststart.
 */
export async function assembleAnimatic(opts: { shots: Shot[]; cues: Cue[]; audio: string; dir: string; seed: string }) {
  const { shots, dir } = opts;
  const fps = 25;
  const fade = 0.6;
  const srt = path.join(dir, "captions.srt");
  await writeFile(srt, toSrt(opts.cues));
  await writeFile(path.join(dir, "captions.vtt"), toVtt(opts.cues));

  const inputs: string[] = [];
  const filters: string[] = [];
  shots.forEach((s, i) => {
    inputs.push("-loop", "1", "-t", s.durationSec.toFixed(2), "-i", s.image);
    const frames = Math.round(s.durationSec * fps);
    const dir2 = i % 2 === 0 ? "+" : "-";
    filters.push(
      `[${i}:v]scale=1600:900,zoompan=z='min(1+${dir2 === "+" ? "on" : `(${frames}-on)`}*0.00045,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1280x720:fps=${fps},format=yuv420p,setpts=PTS-STARTPTS[v${i}]`,
    );
  });
  // Chain crossfades.
  let last = "v0";
  let offset = shots[0].durationSec - fade;
  for (let i = 1; i < shots.length; i++) {
    const outLabel = `x${i}`;
    filters.push(`[${last}][v${i}]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(2)}[${outLabel}]`);
    last = outLabel;
    offset += shots[i].durationSec - fade;
  }
  const total = shots.reduce((n, s) => n + s.durationSec, 0) - fade * (shots.length - 1);
  const style = "FontName=DejaVu Sans,FontSize=15,PrimaryColour=&H00F0F8FB,OutlineColour=&H80000000,BorderStyle=1,Outline=1.2,Shadow=0,MarginV=36";
  filters.push(`[${last}]subtitles=${srt.replace(/([:\\'])/g, "\\$1")}:force_style='${style}'[vout]`);

  const out = path.join(dir, "animatic.mp4");
  const audioIndex = shots.length;
  await run(
    FFMPEG(),
    [
      "-y", "-hide_banner", "-loglevel", "error",
      ...inputs,
      "-i", opts.audio,
      "-filter_complex", filters.join(";"),
      "-map", "[vout]", "-map", `${audioIndex}:a`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k",
      "-t", total.toFixed(2),
      "-movflags", "+faststart",
      out,
    ],
    { maxBuffer: 1 << 26 },
  );
  // Open-codec rendition for browsers without H.264 support.
  const webm = path.join(dir, "animatic.webm");
  await run(FFMPEG(), ["-y", "-hide_banner", "-loglevel", "error", "-i", out, "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "1500k", "-row-mt", "1", "-c:a", "libopus", "-b:a", "96k", webm], { maxBuffer: 1 << 26 });
  return { video: out, webm, srt, vtt: path.join(dir, "captions.vtt"), durationSec: total };
}

export interface ProbeResult {
  durationSec: number;
  width: number;
  height: number;
  videoCodec: string | null;
  audioCodec: string | null;
  meanVolumeDb: number | null;
}

/** Technical QA: container facts from ffprobe + loudness from volumedetect. */
export async function probe(file: string): Promise<ProbeResult> {
  const { stdout } = await run(FFPROBE(), ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]);
  const j = JSON.parse(stdout) as { streams: { codec_type: string; codec_name: string; width?: number; height?: number }[]; format: { duration: string } };
  const v = j.streams.find((s) => s.codec_type === "video");
  const a = j.streams.find((s) => s.codec_type === "audio");
  let meanVolumeDb: number | null = null;
  if (a) {
    const { stderr } = await run(FFMPEG(), ["-hide_banner", "-i", file, "-af", "volumedetect", "-vn", "-f", "null", "-"], { maxBuffer: 1 << 24 });
    const m = stderr.match(/mean_volume:\s*(-?[\d.]+) dB/);
    meanVolumeDb = m ? Number(m[1]) : null;
  }
  return {
    durationSec: Number(j.format.duration),
    width: v?.width ?? 0,
    height: v?.height ?? 0,
    videoCodec: v?.codec_name ?? null,
    audioCodec: a?.codec_name ?? null,
    meanVolumeDb,
  };
}

/** Lay voiced lines over the score at their cue times (score ducked under dialogue). */
export async function mixDialogue(score: string, lines: { file: string; start: number }[], out: string) {
  if (!lines.length) return score;
  const inputs = ["-i", score, ...lines.flatMap((l) => ["-i", l.file])];
  const parts = lines.map((l, i) => `[${i + 1}:a]adelay=${Math.round(l.start * 1000)}|${Math.round(l.start * 1000)},aformat=channel_layouts=stereo[d${i}]`);
  const voices = lines.map((_, i) => `[d${i}]`).join("");
  const filter = [
    ...parts,
    `${voices}amix=inputs=${lines.length}:normalize=0[vox]`,
    `[0:a]volume=0.55[bed]`,
    `[bed][vox]amix=inputs=2:duration=first:normalize=0[out]`,
  ].join(";");
  await run(FFMPEG(), ["-y", "-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", filter, "-map", "[out]", "-c:a", "aac", "-b:a", "160k", out]);
  return out;
}
