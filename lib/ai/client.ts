"use client";

import type {
  BriefIn,
  CharacterIn,
  CharacterOutT,
  DevelopIn,
  DevelopOutT,
  DirectorIn,
  DirectorOutT,
  DiscoveryIn,
  DiscoveryOutT,
  SocialOutT,
  StudioAssetsOutT,
  StudioIn,
  WorldExpandOutT,
} from "./schemas";

export interface AIResponse<T> {
  data: T;
  source: "claude" | "mock";
  note?: string;
}

async function call<T>(task: string, input: unknown): Promise<AIResponse<T>> {
  const res = await fetch(`/api/ai/${task}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`AI task ${task} failed (${res.status})`);
  return res.json();
}

export const ai = {
  discovery: (i: DiscoveryIn) => call<DiscoveryOutT>("discovery", i),
  develop: (i: DevelopIn) => call<DevelopOutT>("develop", i),
  character: (i: CharacterIn) => call<CharacterOutT>("character", i),
  world: (i: BriefIn) => call<WorldExpandOutT>("world", i),
  studio: (i: StudioIn) => call<StudioAssetsOutT>("studio", i),
  social: (i: BriefIn) => call<SocialOutT>("social", i),
  director: (i: DirectorIn) => call<DirectorOutT>("director", i),
};
