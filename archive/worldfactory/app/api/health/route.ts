import { MODEL } from "@/lib/ai/tasks";

export function GET() {
  const live = process.env.WORLDFACTORY_MOCK !== "1" && Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  return Response.json({ ai: live ? "claude" : "mock", model: MODEL });
}
