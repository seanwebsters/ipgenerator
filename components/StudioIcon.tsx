import {
  BookOpenText,
  Clapperboard,
  FlaskConical,
  Gamepad2,
  Globe,
  Library,
  Megaphone,
  AudioLines,
  Palette,
  ShieldCheck,
  Shirt,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { StudioKey } from "@/lib/types";

const ICONS: Record<StudioKey, LucideIcon> = {
  "ip-lab": FlaskConical,
  characters: Users,
  world: Globe,
  story: BookOpenText,
  social: Megaphone,
  animation: Clapperboard,
  music: AudioLines,
  games: Gamepad2,
  publishing: Library,
  merch: Shirt,
  brand: Palette,
  vault: ShieldCheck,
};

export function StudioIcon({ studio, className }: { studio: StudioKey; className?: string }) {
  const Icon = ICONS[studio];
  return <Icon className={className} />;
}
