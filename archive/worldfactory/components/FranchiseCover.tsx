import type { Franchise } from "@/lib/types";
import { cx } from "@/lib/util";

/** Generative cover art from the concept palette and the cast's colours. */
export function FranchiseCover({ franchise, className, children }: { franchise: Franchise; className?: string; children?: React.ReactNode }) {
  const [a, b, c, d] = [...franchise.concept.palette, "#1e1b4b", "#6d28d9", "#fbbf24", "#a7f3d0"];
  return (
    <div
      className={cx("relative overflow-hidden", className)}
      style={{
        background: `radial-gradient(120% 90% at 85% 10%, ${b}cc 0%, transparent 55%), radial-gradient(80% 70% at 10% 100%, ${d}55 0%, transparent 60%), linear-gradient(160deg, ${a} 0%, #07070c 100%)`,
      }}
    >
      <div className="absolute right-[12%] top-[18%] h-16 w-16 rounded-full" style={{ background: c, boxShadow: `0 0 60px 10px ${c}66` }} />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-end gap-1.5 px-6 pb-4">
        {franchise.characters.slice(0, 6).map((ch, i) => (
          <div
            key={ch.id}
            title={ch.name}
            className="rounded-t-full"
            style={{ width: 22 + ((i * 7) % 14), height: 34 + ((i * 13) % 28), background: `linear-gradient(${ch.color}, ${ch.color}55)`, opacity: 0.9 }}
          />
        ))}
      </div>
      {children}
    </div>
  );
}
