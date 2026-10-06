import { Link } from "wouter";
import { useGetDashboard, getGetDashboardQueryKey, type Vehicle } from "@workspace/api-client-react";
import { Car, ClipboardList, Users, Settings, ArrowRight, RotateCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, StatusBadge, ErrorState, Panel, EmptyState, statusBar } from "@/components/kit";
import { cn } from "@/lib/utils";
import { errMsg, fmtCLP, fmtDateTime, fmtKm, fmtNum } from "@/lib/fmt";

function VehicleCard({ v, i }: { v: Vehicle; i: number }) {
  const used = v.maintenanceInterval > 0 ? Math.min(1, Math.max(0, (v.currentKm - v.lastMaintenanceKm) / v.maintenanceInterval)) : 0;
  return (
    <article data-testid={`card-vehicle-${v.id}`} className={cn("rise rounded-md border border-card-border bg-card p-4", !v.active && "opacity-60")} style={{ animationDelay: `${i * 40}ms` }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="num inline-block rounded-sm border-2 border-foreground px-2 py-0.5 text-sm font-semibold tracking-widest">{v.plate}</div>
          <div className="mt-2 text-sm font-semibold">{v.brand} {v.model} <span className="text-muted-foreground">· {v.year}</span></div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={v.status} />
          {!v.active && <span className="text-[10px] font-semibold uppercase text-muted-foreground">Inactivo</span>}
        </div>
      </div>
      <div className="mt-4">
        <div className="num text-2xl font-semibold">{fmtKm(v.currentKm)}</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className={cn("h-full", statusBar[v.status])} style={{ width: `${used * 100}%` }} /></div>
        <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
          <span>Próx. mantención {fmtKm(v.nextMaintenanceKm)}</span>
          <span className={cn("num font-semibold", v.remainingKm < 0 ? "text-overdue" : "text-foreground")}>{v.remainingKm < 0 ? `+${fmtNum(-v.remainingKm)} km vencida` : `${fmtNum(v.remainingKm)} km`}</span>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3 text-xs">
        <div><dt className="text-muted-foreground">Últ. mantención</dt><dd className="num">{fmtKm(v.lastMaintenanceKm)}</dd></div>
        <div><dt className="text-muted-foreground">Intervalo</dt><dd className="num">{fmtKm(v.maintenanceInterval)}</dd></div>
        <div><dt className="text-muted-foreground">Último conductor</dt><dd className="truncate font-medium">{v.lastDriver || "—"}</dd></div>
        <div><dt className="text-muted-foreground">Último registro</dt><dd>{v.lastRecord ? fmtDateTime(v.lastRecord) : "—"}</dd></div>
      </dl>
    </article>
  );
}

export default function Dashboard() {
  const q = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey(), refetchInterval: 15_000 } });
  const d = q.data;
  return (
    <div>
      <PageHeader eyebrow="Panel de flota" title="Estado de la flota" desc="Se actualiza automáticamente cada 15 segundos."
        actions={<span className="num flex items-center gap-1.5 text-xs text-muted-foreground"><RotateCw className={cn("h-3.5 w-3.5", q.isFetching && "animate-spin")} />{q.dataUpdatedAt ? new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", timeStyle: "medium" }).format(q.dataUpdatedAt) : "—"}</span>} />
      {q.isLoading ? (
        <div className="space-y-4"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-60" />)}</div></div>
      ) : q.isError || !d ? (
        <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 divide-border overflow-hidden rounded-md border border-card-border bg-card lg:grid-cols-4 lg:divide-x">
            {[["Viajes registrados", fmtNum(d.totalTrips)], ["Distancia total", fmtKm(d.totalDistance)], ["Gasto combustible", fmtCLP(d.fuelCost)], ["Conductores activos", fmtNum(d.activeDrivers)]].map(([l, v]) => (
              <div key={l} className="border-b border-border p-4 lg:border-b-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{l}</div>
                <div data-testid={`stat-${l}`} className="num mt-1 text-xl font-semibold md:text-2xl">{v}</div>
              </div>
            ))}
          </div>
          {d.vehicles.length === 0 ? (
            <Panel title="Puesta en marcha">
              <div className="grid gap-px bg-border md:grid-cols-3">
                {[
                  { n: "01", t: "Registre los vehículos", s: "Patente, kilometraje actual e intervalo de mantención.", href: "/vehiculos", icon: Car },
                  { n: "02", t: "Habilite conductores", s: "Asigne un PIN a cada persona autorizada para conducir.", href: "/conductores", icon: Users },
                  { n: "03", t: "Defina los correos", s: "Destinatario de alertas de mantención.", href: "/configuracion", icon: Settings },
                ].map((x) => (
                  <Link key={x.n} href={x.href} data-testid={`link-setup-${x.n}`} className="group flex flex-col gap-3 bg-card p-5 transition-colors hover:bg-secondary/60">
                    <div className="flex items-center justify-between"><span className="num text-xs text-accent">{x.n}</span><x.icon className="h-4 w-4 text-primary" /></div>
                    <div className="font-bold">{x.t}</div>
                    <div className="text-sm text-muted-foreground">{x.s}</div>
                    <div className="mt-auto flex items-center gap-1 text-xs font-semibold text-primary">Comenzar <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></div>
                  </Link>
                ))}
              </div>
            </Panel>
          ) : (
            <div className="mb-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{d.vehicles.map((v, i) => <VehicleCard key={v.id} v={v} i={i} />)}</div>
          )}
          <Panel title="Viajes recientes" className="mt-6" right={<Link href="/historial" className="text-xs font-semibold text-primary">Ver historial</Link>}>
            {d.recentTrips.length === 0 ? (
              <div className="p-4"><EmptyState icon={<ClipboardList className="h-5 w-5" />} title="Sin viajes todavía" desc="Los viajes aparecerán aquí apenas un conductor registre el primero." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">{["Fecha", "Patente", "Conductor", "Ruta", "Km", "Distancia"].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
                  <tbody>
                    {d.recentTrips.map((t) => (
                      <tr key={t.id} data-testid={`row-recent-${t.id}`} className="border-b border-border/60 last:border-0">
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs">{fmtDateTime(t.at)}</td>
                        <td className="num px-4 py-2.5 font-semibold">{t.plate}</td>
                        <td className="px-4 py-2.5">{t.driverName}</td>
                        <td className="px-4 py-2.5">{t.origin} <span className="text-muted-foreground">→</span> {t.destination}</td>
                        <td className="num whitespace-nowrap px-4 py-2.5 text-xs">{fmtNum(t.initialKm)}–{fmtNum(t.finalKm)}</td>
                        <td className="num px-4 py-2.5 font-semibold">{fmtKm(t.distance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
