import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListVehicles, useCreateVehicle, useUpdateVehicle,
  getListVehiclesQueryKey, getGetDashboardQueryKey, type Vehicle, type VehicleInput,
} from "@workspace/api-client-react";
import { Car, Plus, Pencil, Loader2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PageHeader, Field, ErrorState, EmptyState, TableSkeleton, StatusBadge, Panel } from "@/components/kit";
import { useToast } from "@/hooks/use-toast";
import { errMsg, fmtKm, toNum } from "@/lib/fmt";

type VF = { plate: string; brand: string; model: string; year: string; currentKm: string; lastMaintenanceKm: string; maintenanceInterval: string; nextMaintenanceKm: string; active: boolean };

const toForm = (v?: Vehicle): VF => v ? {
  plate: v.plate, brand: v.brand, model: v.model, year: String(v.year), currentKm: String(v.currentKm), lastMaintenanceKm: String(v.lastMaintenanceKm),
  maintenanceInterval: String(v.maintenanceInterval), nextMaintenanceKm: String(v.nextMaintenanceKm), active: v.active,
} : { plate: "", brand: "", model: "", year: String(new Date().getFullYear()), currentKm: "", lastMaintenanceKm: "", maintenanceInterval: "10000", nextMaintenanceKm: "", active: true };

export const toVehicleInput = (v: Vehicle, patch: Partial<VehicleInput> = {}): VehicleInput => ({
  plate: v.plate, brand: v.brand, model: v.model, year: v.year, currentKm: v.currentKm, lastMaintenanceKm: v.lastMaintenanceKm,
  maintenanceInterval: v.maintenanceInterval, nextMaintenanceKm: v.nextMaintenanceKm, active: v.active, ...patch,
});

function useInvalidate() {
  const qc = useQueryClient();
  return () => { qc.invalidateQueries({ queryKey: getListVehiclesQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); };
}

function VehicleDialog({ vehicle, onClose }: { vehicle?: Vehicle; onClose: () => void }) {
  const inv = useInvalidate();
  const { toast } = useToast();
  const create = useCreateVehicle();
  const update = useUpdateVehicle();
  const [f, setF] = useState<VF>(toForm(vehicle));
  const [nextTouched, setNextTouched] = useState(!!vehicle);
  const [tried, setTried] = useState(false);
  const set = (p: Partial<VF>) => setF((prev) => {
    const n = { ...prev, ...p };
    if (!nextTouched && ("lastMaintenanceKm" in p || "maintenanceInterval" in p)) {
      const a = toNum(n.lastMaintenanceKm), b = toNum(n.maintenanceInterval);
      if (!Number.isNaN(a) && !Number.isNaN(b)) n.nextMaintenanceKm = String(a + b);
    }
    return n;
  });
  const y = toNum(f.year), cur = toNum(f.currentKm), last = toNum(f.lastMaintenanceKm), int = toNum(f.maintenanceInterval), next = toNum(f.nextMaintenanceKm);
  const e: Partial<Record<keyof VF, string>> = {};
  if (!f.plate.trim()) e.plate = "Requerida.";
  if (!f.brand.trim()) e.brand = "Requerida.";
  if (!f.model.trim()) e.model = "Requerido.";
  if (Number.isNaN(y) || y < 1950 || y > new Date().getFullYear() + 1) e.year = "Año inválido.";
  if (Number.isNaN(cur) || cur < 0) e.currentKm = "Ingrese 0 o más.";
  if (Number.isNaN(last) || last < 0) e.lastMaintenanceKm = "Ingrese 0 o más.";
  else if (!Number.isNaN(cur) && last > cur) e.lastMaintenanceKm = "No puede superar el km actual.";
  if (Number.isNaN(int) || int <= 0) e.maintenanceInterval = "Mayor a 0.";
  if (Number.isNaN(next) || next < 0) e.nextMaintenanceKm = "Ingrese 0 o más.";
  const pending = create.isPending || update.isPending;
  const err = create.error || update.error;
  const submit = (ev: FormEvent) => {
    ev.preventDefault(); setTried(true);
    if (Object.keys(e).length) return;
    const data: VehicleInput = { plate: f.plate.trim().toUpperCase(), brand: f.brand.trim(), model: f.model.trim(), year: y, currentKm: cur, lastMaintenanceKm: last, maintenanceInterval: int, nextMaintenanceKm: next, active: f.active };
    const done = { onSuccess: () => { inv(); toast({ title: vehicle ? "Vehículo actualizado" : "Vehículo registrado" }); onClose(); } };
    if (vehicle) update.mutate({ id: vehicle.id, data }, done); else create.mutate({ data }, done);
  };
  const s = (k: keyof VF) => (tried ? e[k] : undefined);
  const num = (k: keyof VF, label: string, hint?: string) => (
    <Field label={label} error={s(k)} hint={hint}>
      <Input data-testid={`input-vehicle-${k}`} className="num" type="number" min={0} value={f[k] as string}
        onChange={(ev) => { if (k === "nextMaintenanceKm") setNextTouched(true); set({ [k]: ev.target.value } as Partial<VF>); }} />
    </Field>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>{vehicle ? `Editar ${vehicle.plate}` : "Nuevo vehículo"}</DialogTitle><DialogDescription>Los kilometrajes alimentan las alertas de mantención.</DialogDescription></DialogHeader>
        <form onSubmit={submit} noValidate className="grid grid-cols-2 gap-4">
          <Field label="Patente" error={s("plate")}><Input data-testid="input-vehicle-plate" className="num uppercase" value={f.plate} onChange={(ev) => set({ plate: ev.target.value.toUpperCase() })} /></Field>
          {num("year", "Año")}
          <Field label="Marca" error={s("brand")}><Input data-testid="input-vehicle-brand" value={f.brand} onChange={(ev) => set({ brand: ev.target.value })} /></Field>
          <Field label="Modelo" error={s("model")}><Input data-testid="input-vehicle-model" value={f.model} onChange={(ev) => set({ model: ev.target.value })} /></Field>
          {num("currentKm", "Km actual")}
          {num("lastMaintenanceKm", "Km última mantención")}
          {num("maintenanceInterval", "Intervalo (km)")}
          {num("nextMaintenanceKm", "Próxima mantención (km)", nextTouched ? undefined : "Calculado: última + intervalo")}
          <label className="col-span-2 flex items-center justify-between rounded-md border border-border p-3">
            <span className="text-sm font-semibold">Vehículo activo<span className="block text-xs font-normal text-muted-foreground">Solo los activos aparecen en el formulario de viaje.</span></span>
            <Switch data-testid="switch-vehicle-active" checked={f.active} onCheckedChange={(v) => set({ active: v })} />
          </label>
          {err && <p className="col-span-2 rounded-sm border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{errMsg(err)}</p>}
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button data-testid="button-save-vehicle" type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Vehicles() {
  const q = useListVehicles({ query: { queryKey: getListVehiclesQueryKey() } });
  const update = useUpdateVehicle();
  const inv = useInvalidate();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<{ v?: Vehicle } | null>(null);
  const toggle = (v: Vehicle) => update.mutate({ id: v.id, data: toVehicleInput(v, { active: !v.active }) }, {
    onSuccess: () => { inv(); toast({ title: v.active ? `${v.plate} desactivado` : `${v.plate} reactivado` }); },
    onError: (e) => toast({ title: "No se pudo actualizar", description: errMsg(e), variant: "destructive" }),
  });
  const list = q.data ?? [];
  return (
    <div>
      <PageHeader eyebrow="Flota" title="Vehículos" desc="Desactive en vez de eliminar: el historial se conserva."
        actions={<Button data-testid="button-new-vehicle" onClick={() => setDialog({})}><Plus className="mr-1.5 h-4 w-4" />Nuevo vehículo</Button>} />
      {q.isLoading ? <TableSkeleton /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /> : list.length === 0 ? (
        <EmptyState icon={<Car className="h-5 w-5" />} title="La flota está vacía" desc="Registre el primer vehículo con su kilometraje actual para comenzar a recibir viajes." action={<Button onClick={() => setDialog({})}><Plus className="mr-1.5 h-4 w-4" />Registrar vehículo</Button>} />
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">{["Patente", "Vehículo", "Km actual", "Últ. mant.", "Intervalo", "Próx. mant.", "Estado", ""].map((h, i) => <th key={i} className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {list.map((v) => (
                  <tr key={v.id} data-testid={`row-vehicle-${v.id}`} className={`border-b border-border/60 last:border-0 ${v.active ? "" : "opacity-55"}`}>
                    <td className="num px-4 py-3 font-semibold">{v.plate}</td>
                    <td className="px-4 py-3">{v.brand} {v.model} <span className="text-muted-foreground">{v.year}</span></td>
                    <td className="num px-4 py-3">{fmtKm(v.currentKm)}</td>
                    <td className="num px-4 py-3">{fmtKm(v.lastMaintenanceKm)}</td>
                    <td className="num px-4 py-3">{fmtKm(v.maintenanceInterval)}</td>
                    <td className="num px-4 py-3">{fmtKm(v.nextMaintenanceKm)}</td>
                    <td className="px-4 py-3">{v.active ? <StatusBadge status={v.status} /> : <span className="text-xs font-semibold uppercase text-muted-foreground">Inactivo</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button data-testid={`button-edit-vehicle-${v.id}`} size="sm" variant="ghost" onClick={() => setDialog({ v })}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button data-testid={`button-toggle-vehicle-${v.id}`} size="sm" variant="ghost" disabled={update.isPending} onClick={() => toggle(v)}><Power className="mr-1 h-3.5 w-3.5" />{v.active ? "Desactivar" : "Activar"}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {dialog && <VehicleDialog vehicle={dialog.v} onClose={() => setDialog(null)} />}
    </div>
  );
}
