import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMaintenances, useListVehicles, useCreateMaintenance,
  getListMaintenancesQueryKey, getListVehiclesQueryKey, getGetDashboardQueryKey, getListAuditQueryKey,
} from "@workspace/api-client-react";
import { Wrench, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PageHeader, Field, NativeSelect, ErrorState, EmptyState, TableSkeleton } from "@/components/kit";
import { ExportCsv } from "@/components/export-csv";
import { useToast } from "@/hooks/use-toast";
import { errMsg, fmtCLP, fmtDate, fmtKm, todayISO, toNum } from "@/lib/fmt";

const TYPES = ["Preventiva", "Correctiva", "Cambio de aceite", "Neumáticos", "Frenos", "Revisión técnica", "Otro"];

function MaintenanceDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const vehicles = useListVehicles({ query: { queryKey: getListVehiclesQueryKey() } }).data ?? [];
  const create = useCreateMaintenance();
  const [f, setF] = useState({ vehicleId: "", date: todayISO(), km: "", type: "Preventiva", description: "", cost: "", observations: "", nextMaintenanceKm: "" });
  const [nextTouched, setNextTouched] = useState(false);
  const [tried, setTried] = useState(false);
  const vehicle = vehicles.find((v) => String(v.id) === f.vehicleId);
  const set = (p: Partial<typeof f>) => setF((prev) => {
    const n = { ...prev, ...p };
    const v = vehicles.find((x) => String(x.id) === n.vehicleId);
    if (p.vehicleId && v && !prev.km) n.km = String(v.currentKm);
    if (!nextTouched && v) { const k = toNum(n.km); if (!Number.isNaN(k)) n.nextMaintenanceKm = String(k + v.maintenanceInterval); }
    return n;
  });
  const km = toNum(f.km), cost = toNum(f.cost), next = toNum(f.nextMaintenanceKm);
  const e: Record<string, string> = {};
  if (!f.vehicleId) e.vehicleId = "Seleccione vehículo.";
  if (!f.date) e.date = "Indique fecha.";
  if (Number.isNaN(km) || km < 0) e.km = "Ingrese 0 o más.";
  if (!f.type.trim()) e.type = "Requerido.";
  if (!f.description.trim()) e.description = "Describa el trabajo.";
  if (Number.isNaN(cost) || cost < 0) e.cost = "Ingrese 0 o más.";
  if (Number.isNaN(next) || next < 0) e.nextMaintenanceKm = "Ingrese 0 o más.";
  else if (!Number.isNaN(km) && next <= km) e.nextMaintenanceKm = "Debe ser mayor al km de la mantención.";
  const submit = (ev: FormEvent) => {
    ev.preventDefault(); setTried(true);
    if (Object.keys(e).length) return;
    create.mutate({ data: { vehicleId: Number(f.vehicleId), date: f.date, km, type: f.type, description: f.description.trim(), cost, observations: f.observations.trim(), nextMaintenanceKm: next } }, {
      onSuccess: () => {
        [getListMaintenancesQueryKey(), getListVehiclesQueryKey(), getGetDashboardQueryKey(), getListAuditQueryKey()].forEach((k) => qc.invalidateQueries({ queryKey: k }));
        toast({ title: "Mantención registrada" }); onClose();
      },
    });
  };
  const s = (k: string) => (tried ? e[k] : undefined);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar mantención</DialogTitle><DialogDescription>Actualiza el kilometraje de la próxima mantención del vehículo.</DialogDescription></DialogHeader>
        <form onSubmit={submit} noValidate className="grid grid-cols-2 gap-4">
          <Field label="Vehículo" error={s("vehicleId")} className="col-span-2">
            <NativeSelect data-testid="select-maint-vehicle" value={f.vehicleId} onChange={(ev) => set({ vehicleId: ev.target.value })}>
              <option value="">Seleccione</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} · {v.brand} {v.model}{v.active ? "" : " (inactivo)"}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Fecha" error={s("date")}><Input data-testid="input-maint-date" type="date" value={f.date} onChange={(ev) => set({ date: ev.target.value })} /></Field>
          <Field label="Km" error={s("km")} hint={vehicle ? `Actual: ${fmtKm(vehicle.currentKm)}` : undefined}><Input data-testid="input-maint-km" className="num" type="number" min={0} value={f.km} onChange={(ev) => set({ km: ev.target.value })} /></Field>
          <Field label="Tipo" error={s("type")}>
            <NativeSelect data-testid="select-maint-type" value={f.type} onChange={(ev) => set({ type: ev.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</NativeSelect>
          </Field>
          <Field label="Costo (CLP)" error={s("cost")}><Input data-testid="input-maint-cost" className="num" type="number" min={0} value={f.cost} onChange={(ev) => set({ cost: ev.target.value })} /></Field>
          <Field label="Descripción" error={s("description")} className="col-span-2"><Input data-testid="input-maint-description" value={f.description} onChange={(ev) => set({ description: ev.target.value })} /></Field>
          <Field label="Próxima mantención (km)" error={s("nextMaintenanceKm")} hint={nextTouched ? undefined : "Por defecto: km + intervalo del vehículo"} className="col-span-2">
            <Input data-testid="input-maint-next" className="num" type="number" min={0} value={f.nextMaintenanceKm} onChange={(ev) => { setNextTouched(true); setF((p) => ({ ...p, nextMaintenanceKm: ev.target.value })); }} />
          </Field>
          <Field label="Observaciones" className="col-span-2"><Textarea data-testid="input-maint-observations" rows={2} value={f.observations} onChange={(ev) => set({ observations: ev.target.value })} /></Field>
          {create.isError && <p className="col-span-2 rounded-sm border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{errMsg(create.error)}</p>}
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button data-testid="button-save-maintenance" type="submit" disabled={create.isPending}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Maintenance() {
  const q = useListMaintenances({ query: { queryKey: getListMaintenancesQueryKey() } });
  const vehiclesCount = useListVehicles({ query: { queryKey: getListVehiclesQueryKey() } }).data?.length ?? 0;
  const [open, setOpen] = useState(false);
  const list = q.data ?? [];
  return (
    <div>
      <PageHeader eyebrow="Taller" title="Mantenciones" desc="Registro de trabajos realizados y próximo hito por vehículo."
        actions={<div className="flex flex-wrap gap-2"><ExportCsv name="mantenciones" disabled={q.isFetching || q.isError} headers={["ID","Patente","Fecha","Kilometraje","Tipo","Descripción","Costo CLP","Observaciones","Próxima mantención km","Responsable"]}
          rows={(q.data??[]).map(m=>[m.id,m.plate,m.date,m.km,m.type,m.description,m.cost,m.observations,m.nextMaintenanceKm,m.actor])} /><Button data-testid="button-new-maintenance" disabled={vehiclesCount === 0} onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Registrar mantención</Button></div>} />
      {q.isLoading ? <TableSkeleton /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /> : list.length === 0 ? (
        <EmptyState icon={<Wrench className="h-5 w-5" />} title="Sin mantenciones registradas" desc={vehiclesCount === 0 ? "Primero registre vehículos en la sección Vehículos." : "Registre la última mantención de cada vehículo para calcular las alertas."} action={vehiclesCount > 0 ? <Button onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Registrar mantención</Button> : undefined} />
      ) : (
        <ol className="relative space-y-3 border-l-2 border-border pl-5">
          {list.map((m) => (
            <li key={m.id} data-testid={`row-maintenance-${m.id}`} className="relative rounded-md border border-card-border bg-card p-4">
              <span className="absolute -left-[27px] top-5 h-3 w-3 rounded-full border-2 border-background bg-accent" />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>{fmtDate(m.date)}</span><span className="num font-semibold text-foreground">{m.plate}</span><span className="rounded-sm bg-secondary px-1.5 py-0.5 font-semibold">{m.type}</span></div>
                  <div className="mt-1 font-semibold">{m.description}</div>
                </div>
                <div className="num text-right font-semibold">{fmtCLP(m.cost)}</div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs sm:grid-cols-4">
                <div><dt className="text-muted-foreground">Km</dt><dd className="num">{fmtKm(m.km)}</dd></div>
                <div><dt className="text-muted-foreground">Próxima</dt><dd className="num">{fmtKm(m.nextMaintenanceKm)}</dd></div>
                <div><dt className="text-muted-foreground">Registrado por</dt><dd>{m.actor || "—"}</dd></div>
                <div><dt className="text-muted-foreground">Observaciones</dt><dd>{m.observations || "—"}</dd></div>
              </dl>
            </li>
          ))}
        </ol>
      )}
      {open && <MaintenanceDialog onClose={() => setOpen(false)} />}
    </div>
  );
}
