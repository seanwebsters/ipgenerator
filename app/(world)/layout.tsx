import { WorldShell } from "@/components/world/shell";

export default function WorldLayout({ children }: { children: React.ReactNode }) {
  return <WorldShell>{children}</WorldShell>;
}
