import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSession, useListVehicles, useListDrivers, useListPublicDrivers, useCreateTrip,
  getGetSessionQueryKey, getListVehiclesQueryKey, getListDriversQueryKey, getListPublicDriversQueryKey,
  getGetDashboardQueryKey, getListTripsQueryKey, getGetFuelSummaryQueryKey,
} from "@workspace/api-client-react";
import { CheckCircle2, Loader2, Car, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ErrorState, EmptyState } from "@/components/kit";
import { TripFields, emptyTrip, validateTrip, toTripInput, type TripForm } from "@/components/trip-fields";
import { errMsg, fmtKm, fmtCLP, nowSantiago, toNum } from "@/lib/fmt";

export default function NewTrip() {
  const qc = useQueryClient();
  const session = useGetSession({ query: { queryKey: getGetSessionQueryKey() } }).data;
  const isAdmin = session?.role === "admin";
  const vehiclesQ = useListVehicles({ query: { queryKey: getListVehiclesQueryKey() } });
  const adminDrivers = useListDrivers({ query: { queryKey: getListDriversQueryKey(), enabled: isAdmin } });
  const pubDrivers = useListPublicDrivers({ query: { queryKey: getListPublicDriversQueryKey(), enabled: !isAdmin } });
  const create = useCreateTrip();
  const ownId = session?.driverId ? String(session.driverId) : "";

  const [f, setF] = useState<TripForm>(emptyTrip(ownId));
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [tried, setTried] = useState(false);
  const [ok, setOk] = useState(false);
  const [review, setReview] = useState<TripForm | null>(null);
  const saving = useRef(false);
  const [clock, setClock] = useState(nowSantiago());
  useEffect(() => { const t = setInterval(() => setClock(nowSantiago()), 30_000); return () => clearInterval(t); }, []);
  useEffect(() => { if (ownId && !isAdmin) setF((p) => ({ ...p, driverId: ownId })); }, [ownId, isAdmin]);

  const vehicles = useMemo(() => (vehiclesQ.data ?? []).filter((v) => v.active), [vehiclesQ.data]);
  const drivers = useMemo(() => {
    if (isAdmin) return (adminDrivers.data ?? []).filter((d) => d.active);
    const own = (pubDrivers.data ?? []).filter((d) => String(d.id) === ownId);
    return own.length ? own : session?.driverId ? [{ id: session.driverId, name: session.name ?? "Conductor", active: true }] : [];
  }, [isAdmin, adminDrivers.data, pubDrivers.data, ownId, session]);
  const vehicle = vehicles.find((v) => String(v.id) === f.vehicleId);
  const errors = validateTrip(f, vehicle ? vehicle.currentKm : null);
  const valid = Object.keys(errors).length === 0;
  const ini = toNum(f.initialKm), fin = toNum(f.finalKm);
  const distance = !Number.isNaN(ini) && !Number.isNaN(fin) && fin >= ini ? fin - ini : null;

  const set = (p: Partial<TripForm>) => {
    setOk(false);
    setTouched((t) => { const n = new Set(t); Object.keys(p).forEach((k) => n.add(k)); return n; });
    setF((prev) => {
      const next = { ...prev, ...p };
      if (p.vehicleId && p.vehicleId !== prev.vehicleId && !prev.initialKm) {
        const v = vehicles.find((x) => String(x.id) === p.vehicleId);
        if (v) next.initialKm = String(v.currentKm);
      }
      return next;
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault(); setTried(true);
    if (!valid || saving.current) return;
    create.reset();
    setReview({ ...f });
  };
  const confirm = () => {
    if (!review || saving.current) return;
    saving.current = true;
    create.mutate({ data: toTripInput(review) }, {
      onSuccess: () => {
        setReview(null);
        setOk(true); setTried(false); setTouched(new Set());
        setF(emptyTrip(isAdmin ? "" : ownId));
        [getListVehiclesQueryKey(), getGetDashboardQueryKey(), getListTripsQueryKey(), getGetFuelSummaryQueryKey()].forEach((k) => qc.invalidateQueries({ queryKey: k }));
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
      onSettled: () => { saving.current = false; },
    });
  };

  const loading = vehiclesQ.isLoading || (isAdmin ? adminDrivers.isLoading : pubDrivers.isLoading);
  const qErr = vehiclesQ.error || (isAdmin ? adminDrivers.error : null);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rise mb-5">
        <p className="num text-[11px] uppercase tracking-[0.18em] text-accent">Nuevo registro</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Registrar viaje</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm capitalize text-muted-foreground"><Clock className="h-3.5 w-3.5" />{clock} <span className="normal-case">· hora automática</span></p>
      </div>

      {ok && (
        <div data-testid="text-trip-success" role="status" className="rise mb-5 flex items-center gap-3 rounded-md border border-ok/40 bg-ok/10 p-4 font-semibold text-ok">
          <CheckCircle2 className="h-5 w-5 shrink-0" />Viaje registrado correctamente
        </div>
      )}
      <Dialog open={review !== null} onOpenChange={(open) => { if (!open && !saving.current) setReview(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto" onEscapeKeyDown={(e) => { if (saving.current) e.preventDefault(); }} onInteractOutside={(e) => { if (saving.current) e.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>¿Está correcto el viaje?</DialogTitle>
            <DialogDescription>Revise el resumen. El viaje se guardará solo al confirmar.</DialogDescription>
          </DialogHeader>
          {review && <dl className="space-y-3 text-sm">
            {[
              ["Conductor", drivers.find(d => String(d.id) === review.driverId)?.name ?? session?.name],
              ["Vehículo", vehicles.find(v => String(v.id) === review.vehicleId)?.plate],
              ["Origen", review.origin.trim()],
              ["Destino", review.destination.trim()],
              ["Kilometraje inicial", fmtKm(toNum(review.initialKm))],
              ["Kilometraje final", fmtKm(toNum(review.finalKm))],
              ["Distancia recorrida", fmtKm(toNum(review.finalKm) - toNum(review.initialKm))],
              ["Acompañantes", toTripInput(review).companions || "Sin acompañantes"],
              ["Carga de combustible", review.refueled ? "Sí" : "No"],
              ...(review.refueled ? [["Litros", review.liters], ["Costo", fmtCLP(toNum(review.fuelCost))]] : []),
              ["Observaciones", review.observations.trim() || "Sin observaciones"],
            ].map(([label, value]) => <div key={label} className="border-b border-border pb-2">
              <dt className="text-muted-foreground">{label}</dt><dd className="break-words whitespace-pre-wrap font-semibold">{value}</dd>
            </div>)}
          </dl>}
          <p className="text-xs text-muted-foreground">La fecha y hora se asignan automáticamente al guardar.</p>
          {create.isError && <p role="alert" className="text-sm text-destructive">{errMsg(create.error)} Puede volver a corregir los datos.</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="h-12 flex-1" disabled={create.isPending} onClick={() => setReview(null)}>Volver a corregir</Button>
            <Button data-testid="button-confirm-trip" type="button" className="h-12 flex-1" disabled={create.isPending} onClick={confirm}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{create.isPending ? "Guardando…" : "Confirmar y guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : qErr ? (
        <ErrorState message={errMsg(qErr)} onRetry={() => { vehiclesQ.refetch(); if (isAdmin) adminDrivers.refetch(); }} />
      ) : vehicles.length === 0 ? (
        <EmptyState icon={<Car className="h-5 w-5" />} title="No hay vehículos activos" desc={isAdmin ? "Registre o active un vehículo antes de cargar viajes." : "Administración aún no habilita vehículos. Consulte con su encargado."} />
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          {vehicle && (
            <div className="rise grid grid-cols-2 overflow-hidden rounded-md border border-card-border bg-card">
              <div className="border-r border-border p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Último odómetro</div>
                <div data-testid="text-last-odometer" className="num mt-1 text-xl font-semibold">{fmtKm(vehicle.currentKm)}</div>
                <div className="num mt-0.5 text-xs text-muted-foreground">{vehicle.plate}</div>
              </div>
              <div className="bg-primary p-4 text-primary-foreground">
                <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Distancia</div>
                <div data-testid="text-distance" className="num mt-1 text-xl font-semibold">{distance == null ? "—" : fmtKm(distance)}</div>
              </div>
            </div>
          )}
          <TripFields f={f} set={set} errors={errors} show={(k) => tried || touched.has(k)} drivers={drivers} vehicles={vehicles} driverLocked={!isAdmin} big />
          {create.isError && <p className="rounded-sm border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{errMsg(create.error)}</p>}
          <Button data-testid="button-register-trip" type="submit" disabled={create.isPending} className="sticky bottom-3 h-14 w-full bg-accent text-lg font-extrabold tracking-wider text-accent-foreground shadow-lg hover:bg-accent/90">
            {create.isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}REGISTRAR VIAJE
          </Button>
        </form>
      )}
    </div>
  );
}
