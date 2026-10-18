import { runTask, TASKS, type TaskName } from "@/lib/ai/tasks";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ task: string }> }) {
  const { task } = await ctx.params;
  if (!(task in TASKS)) return Response.json({ error: `Unknown task "${task}"` }, { status: 404 });
  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const result = await runTask(task as TaskName, input);
  return Response.json(result);
}
