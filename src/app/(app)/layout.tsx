import Link from "next/link";
import { Settings } from "lucide-react";
import { requireAuth } from "@/server/auth";
import { cloudSetupProblems } from "@/server/deployment";
import { CloudSetupHelp } from "@/components/cloud-setup-help";
import { MobileNav, Sidebar } from "@/components/nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (cloudSetupProblems().length) return <CloudSetupHelp />;
  // Macht alle Seiten dynamisch und schützt sie.
  await requireAuth();
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 md:flex">
        <Link href="/" className="mb-6 px-3 text-lg font-semibold tracking-tight">
          Abi<span className="text-accent">OS</span>
        </Link>
        <Sidebar />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
          <Link href="/" className="font-semibold tracking-tight">
            Abi<span className="text-accent">OS</span>
          </Link>
          <div className="flex gap-3 text-sm text-muted">
            <Link href="/faecher">Fächer</Link>
            <Link href="/einstellungen" aria-label="Einstellungen">
              <Settings className="size-5" />
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 md:px-8 md:pt-10 md:pb-12">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
