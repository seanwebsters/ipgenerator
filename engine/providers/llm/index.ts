import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { db } from "../../../lib/db";
import { MissingCredentialError, PolicyError } from "../../../lib/errors";
import { getSecret, PROVIDERS } from "../../credentials";
import { meter } from "../../metering";

export const DEFAULT_MODEL = "claude-opus-5-5";

/** USD per million tokens (input, output). Source: Anthropic pricing. */
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-fable-5-1": [10, 50],
};

export interface StructuredRequest<T> {
  task: string;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** Deterministic DEMO output, used only when no LLM is configured and DEMO is allowed. */
  demo: () => T;
  maxTokens?: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  runId?: string | null;
  stepKey?: string | null;
  agentKey?: string | null;
}

export interface StructuredResult<T> {
  data: T;
  provider: string;
  model: string;
  isDemo: boolean;
}

let cached: { key: string; client: Anthropic } | null = null;
function anthropic(key: string) {
  if (cached?.key !== key) cached = { key, client: new Anthropic({ apiKey: key }) };
  return cached.client;
}

async function route(task: string) {
  const r = await db.modelRoute.findUnique({ where: { task } });
  return { provider: r?.provider ?? "anthropic", model: r?.model ?? DEFAULT_MODEL };
}

export async function generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
  const { provider, model } = await route(req.task);
  const key = provider === "anthropic" ? await getSecret("anthropic") : null;

  if (!key) {
    const settings = await db.studioSettings.findUniqueOrThrow({ where: { id: "studio" } });
    if (!settings.allowDemoProvider) {
      throw new MissingCredentialError("anthropic", PROVIDERS.find((p) => p.key === "anthropic")!.setup);
    }
    const data = await meter(
      { provider: "demo", model: "demo-deterministic", task: req.task, runId: req.runId, stepKey: req.stepKey, agentKey: req.agentKey, estimateUsd: 0, isDemo: true },
      async () => ({ result: req.demo(), costUsd: 0 }),
    );
    return { data, provider: "demo", model: "demo-deterministic", isDemo: true };
  }

  const maxTokens = req.maxTokens ?? 16_000;
  const [pin, pout] = PRICES[model] ?? PRICES[DEFAULT_MODEL];
  // Budget hold: worst case is the prompt (~4 chars/token) plus max output.
  const estimateUsd = ((req.system.length + req.prompt.length) / 4 / 1e6) * pin + (maxTokens / 1e6) * pout;

  const data = await meter(
    { provider: "anthropic", model, task: req.task, runId: req.runId, stepKey: req.stepKey, agentKey: req.agentKey, estimateUsd },
    async () => {
      const res = await anthropic(key).messages.parse({
        model,
        max_tokens: maxTokens,
        system: req.system,
        output_config: { effort: req.effort ?? "medium", format: zodOutputFormat(req.schema) },
        messages: [{ role: "user", content: req.prompt }],
      });
      if (res.stop_reason === "refusal") throw new PolicyError(`Claude declined task ${req.task} (${res.stop_details?.category ?? "unspecified"}). Needs human review.`);
      if (res.stop_reason === "max_tokens") throw new Error(`Output for ${req.task} hit max_tokens (${maxTokens}).`);
      if (res.parsed_output == null) throw new Error(`Claude returned no parseable output for ${req.task}.`);
      const costUsd = (res.usage.input_tokens / 1e6) * pin + (res.usage.output_tokens / 1e6) * pout;
      return {
        result: res.parsed_output as T,
        costUsd,
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
        requestId: res._request_id ?? undefined,
      };
    },
  );
  return { data, provider: "anthropic", model, isDemo: false };
}
