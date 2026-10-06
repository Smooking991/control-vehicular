import type { ReactNode, SelectHTMLAttributes } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/fmt";

export function PageHeader({ eyebrow, title, desc, actions }: { eyebrow: string; title: string; desc?: string; actions?: ReactNode }) {
  return (
    <header className="rise mb-6 flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="num text-[11px] uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
        {desc && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

const statusCls: Record<string, string> = {
  normal: "bg-ok/10 text-ok border-ok/30",
  warning: "bg-warn/10 text-warn border-warn/35",
  urgent: "bg-urgent/10 text-urgent border-urgent/35",
  overdue: "bg-overdue text-primary-foreground border-overdue",
};
export const statusBar: Record<string, string> = {
  normal: "bg-ok", warning: "bg-warn", urgent: "bg-urgent", overdue: "bg-overdue",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span data-testid={`status-${status}`} className={cn("inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", statusCls[status] ?? statusCls.normal)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", status === "overdue" ? "bg-primary-foreground" : statusBar[status])} />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Field({ label, error, hint, children, className }: { label: string; error?: string | false; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
      {error ? <span className="text-xs font-medium text-destructive">{error}</span> : hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function NativeSelect({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={cn("h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60", className)}>
      {children}
    </select>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-destructive"><AlertTriangle className="h-4 w-4" />No se pudo cargar la información</div>
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry} data-testid="button-retry"><RotateCw className="mr-1.5 h-3.5 w-3.5" />Reintentar</Button>}
    </div>
  );
}

export function EmptyState({ icon, title, desc, action }: { icon: ReactNode; title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="ledger-bg flex flex-col items-center rounded-md border border-dashed border-border px-6 py-12 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-full border border-border bg-card text-primary">{icon}</div>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{desc}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
    </div>
  );
}

export function Panel({ title, right, children, className }: { title?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-md border border-card-border bg-card", className)}>
      {title && (
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide">{title}</h2>{right}
        </div>
      )}
      {children}
    </section>
  );
}
