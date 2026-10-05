"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ChartNoAxesColumn,
  FileText,
  FolderTree,
  GraduationCap,
  House,
  ListChecks,
  RotateCcw,
  Settings,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { cx } from "./ui";

type Item = { href: string; label: string; icon: LucideIcon; soon?: boolean; mobile?: boolean };

const ITEMS: Item[] = [
  { href: "/", label: "Dashboard", icon: House, mobile: true },
  { href: "/lernen", label: "Lernen", icon: BookOpen, mobile: true },
  { href: "/ueben", label: "Üben", icon: ListChecks, mobile: true },
  { href: "/klausuren", label: "Klausuren", icon: GraduationCap, soon: true },
  { href: "/wiederholen", label: "Wiederholen", icon: RotateCcw, soon: true },
  { href: "/fehler", label: "Fehler", icon: TriangleAlert, soon: true },
  { href: "/materialien", label: "Materialien", icon: FileText, mobile: true },
  { href: "/faecher", label: "Fächer & Themen", icon: FolderTree },
  { href: "/fortschritt", label: "Fortschritt", icon: ChartNoAxesColumn, mobile: true },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Hauptnavigation">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        if (item.soon) {
          return (
            <span
              key={item.href}
              className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted/60"
              title="Kommt in Phase 3"
            >
              <Icon className="size-4" />
              {item.label}
              <span className="ml-auto text-[10px] uppercase tracking-wide">bald</span>
            </span>
          );
        }
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
              active ? "bg-surface-2 font-medium text-text" : "text-muted hover:bg-surface-2 hover:text-text",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Hauptnavigation"
    >
      <div className="grid grid-cols-5">
        {ITEMS.filter((i) => i.mobile).map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "flex flex-col items-center gap-1 py-2 text-[11px]",
                active ? "text-accent" : "text-muted",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
