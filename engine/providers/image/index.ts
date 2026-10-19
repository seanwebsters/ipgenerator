import { db } from "../../../lib/db";
import { MissingCredentialError } from "../../../lib/errors";
import { getSecret, PROVIDERS } from "../../credentials";
import { meter } from "../../metering";
import { renderPng, type SceneSpec } from "../../media/render";
import type { TaskMeta } from "../../tasks/common";

/**
 * Provider-agnostic image generation.
 * Routes (ModelRoute.task = "visual.frames" | "visual.keyart"):
 *   - "procedural" (default): local deterministic renderer, $0, not AI.
 *   - "openai": gpt-image-1 via POST /v1/images/generations (needs a key).
 * A route that points at an unconfigured provider BLOCKS — it never silently
 * downgrades to a different provider.
 */
export interface ImageRequest extends TaskMeta {
  task: "visual.frames" | "visual.keyart";
  prompt: string;
  scene: SceneSpec;
}

export interface ImageResult {
  png: Buffer;
  provider: string;
  model: string;
  aiGenerated: boolean;
  rightsNotes: string;
}

/** Image price is not returned by the API; this is a budgeting estimate. */
const OPENAI_IMAGE_ESTIMATE_USD = Number(process.env.OPENAI_IMAGE_USD ?? 0.07);

export async function generateImage(req: ImageRequest): Promise<ImageResult> {
  const route = await db.modelRoute.findUnique({ where: { task: req.task } });
  const provider = route?.provider ?? "procedural";

  if (provider === "openai") {
    const key = await getSecret("openai");
    if (!key) throw new MissingCredentialError("openai", PROVIDERS.find((p) => p.key === "openai")!.setup);
    const model = route?.model ?? "gpt-image-1";
    const size = req.scene.width > req.scene.height ? "1536x1024" : req.scene.width < req.scene.height ? "1024x1536" : "1024x1024";
    const png = await meter(
      { provider: "openai", model, task: req.task, runId: req.runId, stepKey: req.stepKey, agentKey: req.agentKey, estimateUsd: OPENAI_IMAGE_ESTIMATE_USD },
      async () => {
        const res = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
          body: JSON.stringify({ model, prompt: req.prompt, size, n: 1 }),
        });
        if (!res.ok) throw new Error(`OpenAI images ${res.status}: ${(await res.text()).slice(0, 300)}`);
        const json = (await res.json()) as { data: { b64_json?: string }[] };
        const b64 = json.data?.[0]?.b64_json;
        if (!b64) throw new Error("OpenAI images returned no image data.");
        return { result: Buffer.from(b64, "base64"), costUsd: OPENAI_IMAGE_ESTIMATE_USD, units: 1, unitLabel: "image (estimated price)", requestId: res.headers.get("x-request-id") ?? undefined };
      },
    );
    return { png, provider: "openai", model, aiGenerated: true, rightsNotes: "Generated with OpenAI gpt-image-1; output rights per OpenAI terms of use. Review for resemblance before commercial use." };
  }

  const png = await meter(
    { provider: "procedural", model: "studio-procedural-v1", task: req.task, runId: req.runId, stepKey: req.stepKey, agentKey: req.agentKey, estimateUsd: 0 },
    async () => ({ result: await renderPng(req.scene), costUsd: 0, units: 1, unitLabel: "frame" }),
  );
  return { png, provider: "procedural", model: "studio-procedural-v1", aiGenerated: false, rightsNotes: "Rendered by Studio's in-house procedural renderer. Owned outright; no third-party model involved." };
}
