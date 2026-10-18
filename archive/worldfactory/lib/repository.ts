import type { Franchise } from "./types";
import { moonwilders } from "./seed";

/**
 * Storage boundary. The app only talks to this interface, so the localStorage
 * implementation can be swapped for Supabase (see supabase/migrations) later.
 */
export interface FranchiseRepository {
  list(): Promise<Franchise[]>;
  get(id: string): Promise<Franchise | null>;
  save(franchise: Franchise): Promise<void>;
  remove(id: string): Promise<void>;
  reset(): Promise<void>;
  subscribe(listener: () => void): () => void;
}

const KEY = "worldfactory.franchises.v1";

export class LocalStorageFranchiseRepository implements FranchiseRepository {
  private listeners = new Set<() => void>();
  private memory: Franchise[] | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === KEY) {
          this.memory = null;
          this.emit();
        }
      });
    }
  }

  private read(): Franchise[] {
    if (this.memory) return this.memory;
    let data: Franchise[] | null = null;
    try {
      const raw = window.localStorage.getItem(KEY);
      data = raw ? (JSON.parse(raw) as Franchise[]) : null;
    } catch {
      data = null;
    }
    if (!data) {
      data = [moonwilders()];
      this.write(data);
    }
    this.memory = data;
    return data;
  }

  private write(data: Franchise[]) {
    this.memory = data;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // Storage full or blocked: keep working from memory for this tab.
    }
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  async list() {
    return [...this.read()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string) {
    return this.read().find((f) => f.id === id) ?? null;
  }

  async save(franchise: Franchise) {
    const data = this.read().filter((f) => f.id !== franchise.id);
    this.write([franchise, ...data]);
    this.emit();
  }

  async remove(id: string) {
    this.write(this.read().filter((f) => f.id !== id));
    this.emit();
  }

  async reset() {
    this.write([moonwilders()]);
    this.emit();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

let repo: FranchiseRepository | null = null;

export function getRepository(): FranchiseRepository {
  repo ??= new LocalStorageFranchiseRepository();
  return repo;
}
