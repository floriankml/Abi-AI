import type { ComponentProps, ReactNode } from "react";

/** Kleine, eigene UI-Bausteine (keine fremde Komponentenbibliothek). */

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60";

const buttonVariants = {
  primary: "bg-accent text-accent-fg hover:opacity-90",
  secondary: "border border-border bg-surface text-text hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-text",
  danger: "border border-border bg-surface text-danger hover:bg-danger-soft",
};

export function buttonClass(variant: keyof typeof buttonVariants = "primary", size: "sm" | "md" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm",
    buttonVariants[variant],
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof buttonVariants; size?: "sm" | "md" }) {
  return <button className={cx(buttonClass(variant, size), className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-xl border border-border bg-surface p-5", className)} {...props} />;
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-text">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const badgeTones = {
  neutral: "bg-surface-2 text-muted",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: keyof typeof badgeTones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function ProgressBar({ value, color }: { value: number | null; color?: string }) {
  const pct = value === null ? 0 : Math.round(value * 100);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-label={`${pct} %`}>
      <div
        className="h-full rounded-full bg-accent transition-all"
        style={{ width: `${pct}%`, ...(color ? { backgroundColor: color } : {}) }}
      />
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Alert({ tone = "danger", children }: { tone?: "danger" | "warning" | "success" | "accent"; children: ReactNode }) {
  const tones = {
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
    success: "bg-success-soft text-success",
    accent: "bg-accent-soft text-accent",
  };
  return <div className={cx("rounded-lg px-3 py-2 text-sm", tones[tone])}>{children}</div>;
}

export function SubjectDot({ color }: { color: string }) {
  return <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}
