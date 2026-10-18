import type { StoryGraph } from "./tasks/expansion";

/**
 * Interactive stories are treated as software: a graph that must pass
 * structural validation before it can ship. Pure and unit-tested.
 */
export interface GraphIssue {
  severity: "error" | "warning";
  message: string;
}

export function validateStoryGraph(g: StoryGraph, canon?: { characters: string[]; locations: string[] }): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const ids = new Set<string>();
  for (const n of g.nodes) {
    if (ids.has(n.id)) issues.push({ severity: "error", message: `Duplicate node id "${n.id}".` });
    ids.add(n.id);
  }
  if (!ids.has(g.start)) issues.push({ severity: "error", message: `Start node "${g.start}" does not exist.` });
  for (const n of g.nodes) {
    if (n.ending && n.choices.length) issues.push({ severity: "error", message: `Ending "${n.id}" must not have choices.` });
    if (!n.ending && n.choices.length === 0) issues.push({ severity: "error", message: `Node "${n.id}" is a dead end (no choices, not an ending).` });
    for (const c of n.choices) if (!ids.has(c.to)) issues.push({ severity: "error", message: `Choice "${c.label}" in "${n.id}" points to missing node "${c.to}".` });
    if (canon) {
      for (const ch of n.characters)
        if (!canon.characters.some((x) => x.toLowerCase() === ch.toLowerCase() || x.split(" ")[0].toLowerCase() === ch.toLowerCase()))
          issues.push({ severity: "warning", message: `Node "${n.id}" uses non-canon character "${ch}".` });
    }
  }
  // Reachability from start.
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const reachable = new Set<string>();
  const stack = ids.has(g.start) ? [g.start] : [];
  while (stack.length) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const c of byId.get(id)?.choices ?? []) if (byId.has(c.to)) stack.push(c.to);
  }
  for (const n of g.nodes) if (!reachable.has(n.id)) issues.push({ severity: "error", message: `Node "${n.id}" is unreachable from the start.` });

  // Every reachable node must be able to reach some ending (no traps).
  const endings = g.nodes.filter((n) => n.ending).map((n) => n.id);
  if (!endings.length) issues.push({ severity: "error", message: "The story has no endings." });
  const canEnd = new Set(endings);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of g.nodes) if (!canEnd.has(n.id) && n.choices.some((c) => canEnd.has(c.to))) {
      canEnd.add(n.id);
      changed = true;
    }
  }
  for (const id of reachable) if (!canEnd.has(id)) issues.push({ severity: "error", message: `From "${id}" no ending can be reached (a loop with no way out).` });
  if (new Set(g.nodes.map((n) => n.ending).filter(Boolean)).size < 2) issues.push({ severity: "warning", message: "Fewer than two distinct ending types." });
  return issues;
}

/** Count distinct start→ending paths (bounded), useful for QA reporting. */
export function countPaths(g: StoryGraph, limit = 10_000): number {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  let count = 0;
  const walk = (id: string, seen: Set<string>) => {
    if (count >= limit) return;
    const n = byId.get(id);
    if (!n) return;
    if (n.ending) {
      count++;
      return;
    }
    for (const c of n.choices) if (!seen.has(c.to)) walk(c.to, new Set(seen).add(c.to));
  };
  walk(g.start, new Set([g.start]));
  return count;
}
