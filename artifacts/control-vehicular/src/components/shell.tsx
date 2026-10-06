import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetSession, useLogout, getGetSessionQueryKey } from "@workspace/api-client-react";
import { Car, ClipboardList, Fuel, Gauge, LogOut, Settings, Users, Wrench, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { errMsg } from "@/lib/fmt";
import { ErrorState } from "@/components/kit";
import AccessPage from "@/pages/access";

const NAV = [
  { href: "/", label: "Panel", icon: Gauge },
  { href: "/viajes/nuevo", label: "Registrar viaje", icon: PlusCircle },
  { href: "/historial", label: "Historial", icon: ClipboardList },
  { href: "/combustible", label: "Combustible", icon: Fuel },
  { href: "/vehiculos", label: "Vehículos", icon: Car },
  { href: "/conductores", label: "Conductores", icon: Users },
  { href: "/mantenciones", label: "Mantenciones", icon: Wrench },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

function Brand({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-8 w-8 place-items-center rounded-sm bg-accent text-accent-foreground"><Gauge className="h-4.5 w-4.5" strokeWidth={2.5} /></div>
      <div className="leading-tight">
        <div className={cn("text-sm font-extrabold tracking-tight", light && "text-sidebar-accent-foreground")}>Control Vehicular</div>
        <div className={cn("num text-[10px] uppercase tracking-[0.16em]", light ? "text-sidebar-foreground/60" : "text-muted-foreground")}>Bitácora de flota</div>
      </div>
    </div>
  );
}

function useDoLogout() {
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const m = useLogout({
    mutation: {
      onSettled: () => {
        qc.clear();
        qc.setQueryData(getGetSessionQueryKey(), { authenticated: false, setupRequired: false });
        qc.invalidateQueries({ queryKey: getGetSessionQueryKey() });
        nav("/acceso");
      },
    },
  });
  return m;
}

export function Shell({ children }: { children: ReactNode }) {
  const [loc, nav] = useLocation();
  const session = useGetSession({ query: { queryKey: getGetSessionQueryKey(), retry: 1, staleTime: 30_000 } });
  const logout = useDoLogout();
  const s = session.data;
  const isDriver = s?.authenticated && s.role === "driver";
  const isAdmin = s?.authenticated && s.role === "admin";

  useEffect(() => {
    if (!s) return;
    if (!s.authenticated && loc !== "/acceso") nav("/acceso");
    else if (isAdmin && loc === "/acceso") nav("/");
    else if (isDriver && loc !== "/viajes/nuevo") nav("/viajes/nuevo");
  }, [s, loc, isAdmin, isDriver, nav]);

  if (session.isLoading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center">
        <div className="flex flex-col items-center gap-3"><Brand /><div className="h-0.5 w-40 overflow-hidden bg-border"><div className="h-full w-1/3 animate-pulse bg-accent" /></div></div>
      </div>
    );
  }
  if (session.isError || !s) {
    return <div className="mx-auto max-w-md p-6 pt-24"><ErrorState message={errMsg(session.error)} onRetry={() => session.refetch()} /></div>;
  }
  if (!s.authenticated) return <AccessPage session={s} />;

  if (isDriver) {
    return (
      <div className="min-h-[100dvh]">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <Brand />
          <button data-testid="button-logout" onClick={() => logout.mutate()} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary">
            <LogOut className="h-3.5 w-3.5" />Salir
          </button>
        </header>
        <main className="mx-auto max-w-xl px-4 py-5">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] md:grid md:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-[100dvh] flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-5 py-5"><Brand light /></div>
        <nav className="flex-1 space-y-0.5 p-3">
          {NAV.map((n) => {
            const active = n.href === "/" ? loc === "/" : loc.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} data-testid={`link-nav-${n.href.replace(/\//g, "") || "panel"}`}
                className={cn("group relative flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground")}>
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-sidebar-primary" />}
                <n.icon className="h-4 w-4" />{n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="num text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/50">Administrador</div>
          <div className="truncate text-sm font-semibold text-sidebar-accent-foreground" data-testid="text-session-name">{s.name}</div>
          <button data-testid="button-logout" onClick={() => logout.mutate()} className="mt-3 flex w-full items-center gap-2 rounded-sm border border-sidebar-border px-3 py-1.5 text-xs font-semibold hover:bg-sidebar-accent">
            <LogOut className="h-3.5 w-3.5" />Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Brand />
            <button data-testid="button-logout-mobile" onClick={() => logout.mutate()} className="rounded-md border border-border p-2"><LogOut className="h-4 w-4" /></button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            {NAV.map((n) => {
              const active = n.href === "/" ? loc === "/" : loc.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} className={cn("whitespace-nowrap rounded-sm px-3 py-1.5 text-xs font-semibold", active ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{n.label}</Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
