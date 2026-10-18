import type { Franchise } from "@/lib/types";

export interface WorkspaceProps {
  franchise: Franchise;
  update: <T>(mutate: (draft: Franchise) => T) => Promise<T | undefined>;
  base: string;
}
