import { db } from "../lib/db";
import { decryptSecret, encryptSecret } from "../lib/crypto";
import { MissingCredentialError } from "../lib/errors";

/** Integration matrix: what each provider does, how to configure it, and its documented API. */
export interface ProviderInfo {
  key: string;
  name: string;
  category: "llm" | "image" | "voice" | "publishing" | "analytics" | "storage";
  env: string[];
  docs: string;
  setup: string;
  implemented: boolean;
  notes: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    key: "anthropic",
    name: "Anthropic Claude",
    category: "llm",
    env: ["ANTHROPIC_API_KEY"],
    docs: "https://docs.claude.com/en/api/messages",
    setup: "Add an Anthropic API key in Settings → Providers, or set ANTHROPIC_API_KEY on the server.",
    implemented: true,
    notes: "All writing, scoring, critique and planning agents. Structured output via messages.parse + zodOutputFormat.",
  },
  {
    key: "openai",
    name: "OpenAI Images",
    category: "image",
    env: ["OPENAI_API_KEY"],
    docs: "https://platform.openai.com/docs/api-reference/images/create",
    setup: "Add an OpenAI API key in Settings → Providers, or set OPENAI_API_KEY. Then route visual.* tasks to openai.",
    implemented: true,
    notes: "gpt-image-1 key art and storyboard frames. Implemented against the documented API; not exercised in CI.",
  },
  {
    key: "elevenlabs",
    name: "ElevenLabs",
    category: "voice",
    env: ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"],
    docs: "https://elevenlabs.io/docs/api-reference/text-to-speech/convert",
    setup: "Add an ElevenLabs key and a voice id from your licensed voice library. Cloned voices of real people need documented authorisation.",
    implemented: true,
    notes: "Narration for animatics. Without it, animatics ship with captions and a procedural temp score.",
  },
  {
    key: "youtube",
    name: "YouTube Data API v3",
    category: "publishing",
    env: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"],
    docs: "https://developers.google.com/youtube/v3/docs/videos/insert",
    setup: "Create an OAuth client with the youtube.upload and yt-analytics.readonly scopes, obtain a refresh token for the channel, and set the three env vars.",
    implemented: true,
    notes: "Resumable upload with status.containsSyntheticMedia=true; privacy defaults to private. Unverified API projects upload as private only.",
  },
  {
    key: "youtube-analytics",
    name: "YouTube Analytics API",
    category: "analytics",
    env: ["YOUTUBE_REFRESH_TOKEN"],
    docs: "https://developers.google.com/youtube/analytics/reference/reports/query",
    setup: "Uses the same OAuth client as YouTube publishing (yt-analytics.readonly scope).",
    implemented: true,
    notes: "views, estimatedMinutesWatched, averageViewDuration, shares per published video.",
  },
  {
    key: "tiktok",
    name: "TikTok Content Posting API",
    category: "publishing",
    env: [],
    docs: "https://developers.tiktok.com/doc/content-posting-api-get-started",
    setup: "Requires a TikTok developer app that has passed audit for direct posting. Not implemented yet.",
    implemented: false,
    notes: "Planned. Unaudited apps can only post privately.",
  },
  {
    key: "instagram",
    name: "Instagram Graph API (content publishing)",
    category: "publishing",
    env: [],
    docs: "https://developers.facebook.com/docs/instagram-platform/content-publishing",
    setup: "Requires a Meta app with instagram_content_publish and an Instagram professional account. Not implemented yet.",
    implemented: false,
    notes: "Planned. Media must be at a public URL, so object storage must be public-readable first.",
  },
];

const ENV_FOR: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  elevenlabs: "ELEVENLABS_API_KEY",
};

/** Server-side only. Env vars win over stored credentials. */
export async function getSecret(provider: string): Promise<string | null> {
  const envName = ENV_FOR[provider];
  if (envName && process.env[envName]) return process.env[envName]!;
  const rec = await db.providerCredential.findUnique({ where: { provider } });
  return rec ? decryptSecret(rec) : null;
}

export async function requireSecret(provider: string): Promise<string> {
  const s = await getSecret(provider);
  if (!s) throw new MissingCredentialError(provider, PROVIDERS.find((p) => p.key === provider)?.setup ?? "Configure it in Settings.");
  return s;
}

export async function storeSecret(provider: string, secret: string) {
  const enc = encryptSecret(secret);
  await db.providerCredential.upsert({
    where: { provider },
    create: { provider, ...enc, last4: secret.slice(-4) },
    update: { ...enc, last4: secret.slice(-4) },
  });
}

export async function credentialStatus() {
  const stored = await db.providerCredential.findMany({ select: { provider: true, last4: true, updatedAt: true } });
  return PROVIDERS.map((p) => {
    const s = stored.find((x) => x.provider === p.key);
    const envSet = p.env.length > 0 && p.env.every((e) => !!process.env[e]);
    return { ...p, configured: envSet || !!s, source: envSet ? "env" : s ? "stored" : null, last4: s?.last4 ?? null };
  });
}
