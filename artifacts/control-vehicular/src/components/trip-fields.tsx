import type { Driver, TripInput, Vehicle } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Field, NativeSelect } from "@/components/kit";
import { fmtKm, toNum } from "@/lib/fmt";

export type TripForm = {
  driverId: string; vehicleId: string; initialKm: string; finalKm: string; origin: string; destination: string;
  companions: string; refueled: boolean; liters: string; fuelCost: string; observations: string;
};

export const emptyTrip = (driverId = ""): TripForm => ({
  driverId, vehicleId: "", initialKm: "", finalKm: "", origin: "", destination: "",
  companions: "", refueled: false, liters: "", fuelCost: "", observations: "",
});

export function validateTrip(f: TripForm, minKm: number | null) {
  const e: Partial<Record<keyof TripForm, string>> = {};
  const ini = toNum(f.initialKm), fin = toNum(f.finalKm);
  if (!f.driverId) e.driverId = "Seleccione conductor.";
  if (!f.vehicleId) e.vehicleId = "Seleccione vehículo.";
  if (Number.isNaN(ini) || ini < 0) e.initialKm = "Ingrese el kilometraje inicial.";
  else if (minKm != null && ini < minKm) e.initialKm = `Debe ser mayor o igual a ${fmtKm(minKm)} (último registro).`;
  if (Number.isNaN(fin)) e.finalKm = "Ingrese el kilometraje final.";
  else if (!Number.isNaN(ini) && fin < ini) e.finalKm = "Debe ser mayor o igual al kilometraje inicial.";
  if (!f.origin.trim()) e.origin = "Indique el origen.";
  if (!f.destination.trim()) e.destination = "Indique el destino.";
  if (f.refueled) {
    const l = toNum(f.liters), c = toNum(f.fuelCost);
    if (Number.isNaN(l) || l < 0) e.liters = "Ingrese litros (0 o más).";
    if (Number.isNaN(c) || c < 0) e.fuelCost = "Ingrese monto (0 o más).";
  }
  return e;
}

export function toTripInput(f: TripForm): TripInput {
  return {
    driverId: Number(f.driverId), vehicleId: Number(f.vehicleId),
    initialKm: toNum(f.initialKm), finalKm: toNum(f.finalKm),
    origin: f.origin.trim(), destination: f.destination.trim(),
    companions: f.companions.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).join(", "),
    refueled: f.refueled,
    liters: f.refueled ? toNum(f.liters) : 0,
    fuelCost: f.refueled ? toNum(f.fuelCost) : 0,
    observations: f.observations.trim(),
  };
}

export function TripFields({ f, set, errors, show, drivers, vehicles, driverLocked, big }: {
  f: TripForm; set: (p: Partial<TripForm>) => void; errors: Partial<Record<keyof TripForm, string>>;
  show: (k: keyof TripForm) => boolean; drivers: Driver[]; vehicles: Vehicle[]; driverLocked?: boolean; big?: boolean;
}) {
  const h = big ? "h-12 text-base" : "";
  const err = (k: keyof TripForm) => (show(k) ? errors[k] : undefined);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Conductor" error={err("driverId")}>
        <NativeSelect data-testid="select-driver" className={h} value={f.driverId} disabled={driverLocked} onChange={(e) => set({ driverId: e.target.value })}>
          {!driverLocked && <option value="">Seleccione</option>}
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </NativeSelect>
      </Field>
      <Field label="Vehículo" error={err("vehicleId")}>
        <NativeSelect data-testid="select-vehicle" className={h} value={f.vehicleId} onChange={(e) => set({ vehicleId: e.target.value })}>
          <option value="">Seleccione</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} · {v.brand} {v.model}</option>)}
        </NativeSelect>
      </Field>
      <Field label="Km inicial" error={err("initialKm")}>
        <Input data-testid="input-initial-km" className={`num ${h}`} inputMode="numeric" type="number" min={0} value={f.initialKm} onChange={(e) => set({ initialKm: e.target.value })} />
      </Field>
      <Field label="Km final" error={err("finalKm")}>
        <Input data-testid="input-final-km" className={`num ${h}`} inputMode="numeric" type="number" min={0} value={f.finalKm} onChange={(e) => set({ finalKm: e.target.value })} />
      </Field>
      <Field label="Inicio del viaje" error={err("origin")}><Input data-testid="input-origin" className={h} value={f.origin} onChange={(e) => set({ origin: e.target.value })} /></Field>
      <Field label="Destino" error={err("destination")}><Input data-testid="input-destination" className={h} value={f.destination} onChange={(e) => set({ destination: e.target.value })} /></Field>
      <Field label="Acompañantes" hint="Separe los nombres con coma. Opcional." className="sm:col-span-2">
        <Input data-testid="input-companions" className={h} value={f.companions} onChange={(e) => set({ companions: e.target.value })} placeholder="Ej.: María Soto, Pedro Lagos" />
      </Field>
      <div className="sm:col-span-2 rounded-md border border-border bg-secondary/40 p-4">
        <label className="flex items-center justify-between gap-3">
          <span><span className="block text-sm font-semibold">¿Se realizó carga de combustible?</span><span className="text-xs text-muted-foreground">Registre litros y monto de la boleta.</span></span>
          <span className="flex items-center gap-2 text-sm font-semibold">{f.refueled ? "Sí" : "No"}<Switch data-testid="switch-refueled" checked={f.refueled} onCheckedChange={(v) => set({ refueled: v })} /></span>
        </label>
        {f.refueled && (
          <div className="rise mt-4 grid grid-cols-2 gap-3">
            <Field label="Litros" error={err("liters")}><Input data-testid="input-liters" className={`num ${h}`} type="number" inputMode="decimal" min={0} step="0.01" value={f.liters} onChange={(e) => set({ liters: e.target.value })} /></Field>
            <Field label="Monto (CLP)" error={err("fuelCost")}><Input data-testid="input-fuel-cost" className={`num ${h}`} type="number" inputMode="numeric" min={0} value={f.fuelCost} onChange={(e) => set({ fuelCost: e.target.value })} /></Field>
          </div>
        )}
      </div>
      <Field label="Observaciones" className="sm:col-span-2"><Textarea data-testid="input-observations" rows={3} value={f.observations} onChange={(e) => set({ observations: e.target.value })} /></Field>
    </div>
  );
}
