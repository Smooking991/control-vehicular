import { useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTrips, useListVehicles, useListDrivers, useCorrectTrip,
  getListTripsQueryKey, getListVehiclesQueryKey, getListDriversQueryKey, getGetDashboardQueryKey,
  getGetFuelSummaryQueryKey, getListAuditQueryKey,
  type ListTripsParams, type Trip,
} from "@workspace/api-client-react";
import { ClipboardList, Pencil, Loader2, X, Fuel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PageHeader, Field, NativeSelect, ErrorState, EmptyState, TableSkeleton, Panel } from "@/components/kit";
import { TripFields, validateTrip, toTripInput, type TripForm } from "@/components/trip-fields";
import { errMsg, fmtCLP, fmtDateTime, fmtKm, fmtNum } from "@/lib/fmt";

type Filters = { from: string; to: string; vehicleId: string; driverId: string; refueled: string; plate: string };
const EMPTY: Filters = { from: "", to: "", vehicleId: "", driverId: "", refueled: "", plate: "" };

export function useFilterParams(f: Filters): ListTripsParams {
  return useMemo(() => {
    const p: ListTripsParams = {};
    (Object.keys(f) as (keyof Filters)[]).forEach((k) => { const v = f[k].trim(); if (v) p[k] = v; });
    return p;
  }, [f]);
}

export function FilterBar({ f, setF, showRefuel = true, showPlate = true }: { f: Filters; setF: (f: Filters) => void; showRefuel?: boolean; showPlate?: boolean }) {
  const vehicles = useListVehicles({ query: { queryKey: getListVehiclesQueryKey() } }).data ?? [];
  const drivers = useListDrivers({ query: { queryKey: getListDriversQueryKey() } }).data ?? [];
  const u = (p: Partial<Filters>) => setF({ ...f, ...p });
  const dirty = Object.values(f).some(Boolean);
  return (
    <Panel className="mb-5">
      <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 lg:grid-cols-6">
        <Field label="Desde"><Input data-testid="filter-from" type="date" value={f.from} onChange={(e) => u({ from: e.target.value })} /></Field>
        <Field label="Hasta"><Input data-testid="filter-to" type="date" value={f.to} onChange={(e) => u({ to: e.target.value })} /></Field>
        <Field label="Vehículo">
          <NativeSelect data-testid="filter-vehicle" value={f.vehicleId} onChange={(e) => u({ vehicleId: e.target.value })}>
            <option value="">Todos</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Conductor">
          <NativeSelect data-testid="filter-driver" value={f.driverId} onChange={(e) => u({ driverId: e.target.value })}>
            <option value="">Todos</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </NativeSelect>
        </Field>
        {showRefuel && (
          <Field label="Combustible">
            <NativeSelect data-testid="filter-refueled" value={f.refueled} onChange={(e) => u({ refueled: e.target.value })}>
              <option value="">Todos</option><option value="true">Con carga</option><option value="false">Sin carga</option>
            </NativeSelect>
          </Field>
        )}
        {showPlate && <Field label="Patente"><Input data-testid="filter-plate" className="num uppercase" value={f.plate} onChange={(e) => u({ plate: e.target.value.toUpperCase() })} placeholder="ABCD12" /></Field>}
      </div>
      {dirty && <div className="border-t border-border px-4 py-2"><button data-testid="button-clear-filters" onClick={() => setF(EMPTY)} className="flex items-center gap-1 text-xs font-semibold text-primary"><X className="h-3.5 w-3.5" />Limpiar filtros</button></div>}
    </Panel>
  );
}

export { EMPTY as EMPTY_FILTERS, type Filters };

function tripToForm(t: Trip): TripForm {
  return {
    driverId: String(t.driverId), vehicleId: String(t.vehicleId), initialKm: String(t.initialKm), finalKm: String(t.finalKm),
    origin: t.origin, destination: t.destination, companions: t.companions ?? "", refueled: t.refueled,
    liters: t.refueled ? String(t.liters) : "", fuelCost: t.refueled ? String(t.fuelCost) : "", observations: t.observations ?? "",
  };
}

function CorrectionDialog({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const qc = useQueryClient();
  const vehicles = useListVehicles({ query: { queryKey: getListVehiclesQueryKey() } }).data ?? [];
  const drivers = useListDrivers({ query: { queryKey: getListDriversQueryKey() } }).data ?? [];
  const correct = useCorrectTrip();
  const [f, setF] = useState<TripForm>(tripToForm(trip));
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const errors = validateTrip(f, null);
  const reasonErr = reason.trim().length < 5 ? "Indique el motivo de la corrección (mínimo 5 caracteres)." : "";
  const submit = (e: FormEvent) => {
    e.preventDefault(); setTried(true);
    if (Object.keys(errors).length || reasonErr) return;
    correct.mutate({ id: trip.id, data: { trip: toTripInput(f), reason: reason.trim() } }, {
      onSuccess: () => {
        [getListTripsQueryKey(), getGetDashboardQueryKey(), getListVehiclesQueryKey(), getGetFuelSummaryQueryKey(), getListAuditQueryKey()].forEach((k) => qc.invalidateQueries({ queryKey: k }));
        onClose();
      },
    });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Corregir viaje #{trip.id}</DialogTitle>
          <DialogDescription>Registrado {fmtDateTime(trip.at)} por {trip.driverName}. La corrección queda en la auditoría con sus valores anteriores.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <TripFields f={f} set={(p) => setF((x) => ({ ...x, ...p }))} errors={errors} show={() => true} drivers={drivers} vehicles={vehicles} />
          <Field label="Motivo de la corrección" error={tried && reasonErr}>
            <Textarea data-testid="input-correction-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {correct.isError && <p className="rounded-sm border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{errMsg(correct.error)}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button data-testid="button-save-correction" type="submit" disabled={correct.isPending}>{correct.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar corrección</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function History() {
  const [f, setF] = useState<Filters>(EMPTY);
  const params = useFilterParams(f);
  const q = useListTrips(params, { query: { queryKey: getListTripsQueryKey(params) } });
  const [editing, setEditing] = useState<Trip | null>(null);
  const trips = q.data ?? [];
  const totals = trips.reduce((a, t) => ({ d: a.d + t.distance, c: a.c + (t.refueled ? t.fuelCost : 0) }), { d: 0, c: 0 });

  return (
    <div>
      <PageHeader eyebrow="Bitácora" title="Historial de viajes" desc="Consulte todos los registros y corrija errores con motivo trazable." />
      <FilterBar f={f} setF={setF} />
      {q.isLoading ? <TableSkeleton /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /> : trips.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-5 w-5" />} title={Object.values(f).some(Boolean) ? "Sin resultados para estos filtros" : "Aún no hay viajes registrados"} desc={Object.values(f).some(Boolean) ? "Pruebe ampliando el rango de fechas o quitando filtros." : "Cuando los conductores registren viajes, aparecerán aquí."} />
      ) : (
        <>
          <div className="num mb-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span><b className="text-foreground">{trips.length}</b> viajes</span><span><b className="text-foreground">{fmtKm(totals.d)}</b> recorridos</span><span><b className="text-foreground">{fmtCLP(totals.c)}</b> en combustible</span>
          </div>
          <div className="space-y-2">
            {trips.map((t) => (
              <article key={t.id} data-testid={`row-trip-${t.id}`} className="rounded-md border border-card-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="num">#{t.id}</span><span>{fmtDateTime(t.at)}</span>
                      {t.corrected && <span className="rounded-sm border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-warn">Corregido</span>}
                      {t.refueled && <span className="flex items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary"><Fuel className="h-3 w-3" />Carga</span>}
                    </div>
                    <div className="mt-1 font-semibold">{t.origin} <span className="text-muted-foreground">→</span> {t.destination}</div>
                    <div className="mt-0.5 text-sm"><span className="num font-semibold">{t.plate}</span> · {t.driverName}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="num text-lg font-semibold">{fmtKm(t.distance)}</div>
                      <div className="num text-xs text-muted-foreground">{fmtNum(t.initialKm)} → {fmtNum(t.finalKm)}</div>
                    </div>
                    <Button data-testid={`button-correct-${t.id}`} size="sm" variant="outline" onClick={() => setEditing(t)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Corregir</Button>
                  </div>
                </div>
                <dl className="mt-3 grid gap-2 border-t border-border pt-3 text-xs sm:grid-cols-3">
                  <div><dt className="text-muted-foreground">Acompañantes</dt><dd>{t.companions || "—"}</dd></div>
                  <div><dt className="text-muted-foreground">Combustible</dt><dd className="num">{t.refueled ? `${fmtNum(t.liters, 2)} L · ${fmtCLP(t.fuelCost)}` : "Sin carga"}</dd></div>
                  <div><dt className="text-muted-foreground">Observaciones</dt><dd>{t.observations || "—"}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </>
      )}
      {editing && <CorrectionDialog trip={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
