import { getSecret } from "../../credentials";
import { meter } from "../../metering";
import type { TaskMeta } from "../../tasks/common";

/**
 * Voice performance via ElevenLabs text-to-speech, using a voice id from the
 * studio's licensed library (ELEVENLABS_VOICE_ID). Studio never clones a
 * real person's voice without documented authorisation, so only a configured
 * library voice is used. Returns null when not configured — callers fall back
 * to captions-only and record that no voice was used.
 */
const USD_PER_1K_CHARS = Number(process.env.ELEVENLABS_USD_PER_1K_CHARS ?? 0.1);

export async function voiceConfigured() {
  return !!(await getSecret("elevenlabs")) && !!process.env.ELEVENLABS_VOICE_ID;
}

export async function speak(text: string, meta: TaskMeta): Promise<Buffer | null> {
  const key = await getSecret("elevenlabs");
  const voice = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voice) return null;
  const model = process.env.ELEVENLABS_MODEL ?? "eleven_flash_v2_5";
  const estimate = (text.length / 1000) * USD_PER_1K_CHARS;
  return meter({ provider: "elevenlabs", model, task: "audio.dialogue", ...meta, estimateUsd: estimate }, async () => {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: model }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return {
      result: Buffer.from(await res.arrayBuffer()),
      costUsd: estimate,
      units: text.length,
      unitLabel: "characters (estimated price)",
      requestId: res.headers.get("request-id") ?? undefined,
    };
  });
}
