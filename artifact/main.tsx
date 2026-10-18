import { createRoot } from "react-dom/client";
import { RouterProvider } from "./shims/router";
import { ToastProvider } from "@/components/Toast";
import { AppShell } from "@/components/AppShell";
import * as M from "@/lib/ai/mock";
import "@/app/globals.css";

import Landing from "@/app/page";
import Portfolio from "@/app/studio/page";
import Launch from "@/app/studio/new/page";
import Workspace from "@/app/studio/f/[id]/[[...section]]/page";

/*
 * The hosted page has no server, so /api/* is answered in the browser by the
 * same deterministic mock generators the server falls back to without a key.
 */
const MOCKS: Record<string, (input: never) => unknown> = {
  discovery: M.mockDiscovery,
  develop: M.mockDevelop,
  character: M.mockCharacter,
  world: M.mockWorldExpand,
  studio: M.mockStudio,
  social: M.mockSocial,
  director: M.mockDirector,
};
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = url.replace(/^https?:\/\/[^/]+/, "");
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (path.startsWith("/api/health")) return json({ ai: "mock", model: "" });
  const m = path.match(/^\/api\/ai\/([a-z]+)/);
  if (m) {
    const fn = MOCKS[m[1]];
    if (!fn) return json({ error: `Unknown task "${m[1]}"` }, 404);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    // a short pause so the studio's "working" states read as they would live
    await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));
    return json({ data: fn(body as never), source: "mock" });
  }
  return realFetch(input, init);
};

const match = (path: string) => {
  const w = path.match(/^\/studio\/f\/([^/]+)(?:\/(.+))?$/);
  if (w) return { id: w[1], section: w[2] ? w[2].split("/") : undefined };
  return {};
};

function Page({ path }: { path: string }) {
  if (path.startsWith("/studio/f/")) return <Workspace />;
  if (path === "/studio/new") return <Launch />;
  if (path.startsWith("/studio")) return <Portfolio />;
  return <Landing />;
}

function App() {
  return (
    <ToastProvider>
      <RouterProvider match={match}>
        {(loc) =>
          loc.path.startsWith("/studio") ? (
            <AppShell>
              <Page key={loc.path + loc.search} path={loc.path} />
            </AppShell>
          ) : (
            <Page key={loc.path + loc.search} path={loc.path} />
          )
        }
      </RouterProvider>
    </ToastProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
