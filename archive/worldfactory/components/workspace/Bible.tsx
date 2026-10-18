"use client";

import { FileDown, FileJson, Printer } from "lucide-react";
import { bibleMarkdown } from "@/lib/franchise";
import { Button, Card } from "@/components/ui";
import { slug } from "@/lib/util";
import type { WorkspaceProps } from "./types";

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function Bible({ franchise: f }: WorkspaceProps) {
  const md = bibleMarkdown(f);
  const file = `${slug(f.name)}-bible-v${f.canon.version}`;
  return (
    <div>
      <div className="no-print mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-display text-3xl font-bold">IP Bible</h1>
          <div className="text-sm text-muted">The canon v{f.canon.version} bible, generated from the live franchise. Share it with partners or archive it in the Vault.</div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => download(`${file}.json`, JSON.stringify(f, null, 2), "application/json")}>
            <FileJson className="h-4 w-4" /> JSON
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print / PDF
          </Button>
          <Button onClick={() => download(`${file}.md`, md, "text/markdown")}>
            <FileDown className="h-4 w-4" /> Download Markdown
          </Button>
        </div>
      </div>
      <Card className="mx-auto max-w-3xl bg-[#f7f3ea] p-10 text-[#1b1a22] print:border-0 print:p-0 print:shadow-none">
        <BibleView md={md} />
      </Card>
    </div>
  );
}

/** Tiny renderer for the subset of Markdown bibleMarkdown() emits. */
function BibleView({ md }: { md: string }) {
  const inline = (s: string) =>
    s
      .split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
      .map((part, i) =>
        part.startsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : part.startsWith("`") ? <code key={i} className="rounded bg-black/5 px-1 font-mono text-xs">{part.slice(1, -1)}</code> : part.startsWith("*") ? <i key={i}>{part.slice(1, -1)}</i> : part,
      );
  return (
    <div className="space-y-2 leading-relaxed">
      {md.split("\n").map((line, i) => {
        if (line.startsWith("# ")) return <h1 key={i} className="font-display text-4xl font-bold">{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={i} className="font-display mt-8 border-b border-black/10 pb-1 text-2xl font-bold">{line.slice(3)}</h2>;
        if (line.startsWith("### ")) return <h3 key={i} className="mt-5 text-lg font-semibold">{inline(line.slice(4))}</h3>;
        if (line.startsWith("> ")) return <p key={i} className="font-display text-xl italic text-[#5b4a8a]">{line.slice(2)}</p>;
        if (line.startsWith("- ")) return <div key={i} className="pl-4 text-[15px]">• {inline(line.slice(2))}</div>;
        if (!line.trim()) return null;
        return <p key={i} className="text-[15px]">{inline(line.replace(/ {2}$/, ""))}</p>;
      })}
    </div>
  );
}
