"use client";

import { useCallback, useEffect, useState } from "react";
import type { Franchise } from "./types";
import { getRepository } from "./repository";
import { nowIso } from "./util";

export function useFranchises() {
  const [items, setItems] = useState<Franchise[] | null>(null);
  useEffect(() => {
    const repo = getRepository();
    const load = () => repo.list().then(setItems);
    load();
    return repo.subscribe(load);
  }, []);
  return items;
}

/**
 * Load one franchise and get an `update` that applies a mutation to a
 * structured clone, then persists it through the repository.
 */
export function useFranchise(id: string) {
  const [franchise, setFranchise] = useState<Franchise | null | undefined>(undefined);
  useEffect(() => {
    const repo = getRepository();
    const load = () => repo.get(id).then((f) => setFranchise(f ? structuredClone(f) : null));
    load();
    return repo.subscribe(load);
  }, [id]);

  const update = useCallback(
    async <T,>(mutate: (draft: Franchise) => T): Promise<T | undefined> => {
      const current = await getRepository().get(id);
      if (!current) return undefined;
      const draft = structuredClone(current);
      const result = mutate(draft);
      draft.updatedAt = nowIso();
      await getRepository().save(draft);
      return result;
    },
    [id],
  );

  return { franchise, update };
}
