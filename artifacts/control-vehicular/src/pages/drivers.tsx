import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDrivers, useCreateDriver, useUpdateDriver,
  getListDriversQueryKey, getListPublicDriversQueryKey, getGetDashboardQueryKey, type Driver, type DriverInput,
} from "@workspace/api-client-react";
import { Users, Plus, Pencil, Loader2, Power, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PageHeader, Field, ErrorState, EmptyState, TableSkeleton } from "@/components/kit";
import { useToast } from "@/hooks/use-toast";
import { errMsg } from "@/lib/fmt";

function useInvalidate() {
  const qc = useQueryClient();
  return () => [getListDriversQueryKey(), getListPublicDriversQueryKey(), getGetDashboardQueryKey()].forEach((k) => qc.invalidateQueries({ queryKey: k }));
}

function DriverDialog({ driver, pinOnly, onClose }: { driver?: Driver; pinOnly?: boolean; onClose: () => void }) {
  const inv = useInvalidate();
  const { toast } = useToast();
  const create = useCreateDriver();
  const update = useUpdateDriver();
  const [name, setName] = useState(driver?.name ?? "");
  const [pin, setPin] = useState("");
  const [active, setActive] = useState(driver?.active ?? true);
  const [tried, setTried] = useState(false);
  const pinRequired = !driver || pinOnly;
  const nameErr = !name.trim() ? "Ingrese el nombre." : "";
  const pinErr = (pinRequired || pin) && !/^\d{6,12}$/.test(pin) ? "El PIN debe tener entre 6 y 12 dígitos." : "";
  const pending = create.isPending || update.isPending;
  const submit = (e: FormEvent) => {
    e.preventDefault(); setTried(true);
    if (nameErr || pinErr) return;
    const data: DriverInput = { name: name.trim(), active, ...(pin ? { pin } : {}) };
    const done = { onSuccess: () => { inv(); toast({ title: pinOnly ? "PIN asignado" : driver ? "Conductor actualizado" : "Conductor habilitado", description: pin ? "Comunique el PIN de forma personal." : undefined }); onClose(); } };
    if (driver) update.mutate({ id: driver.id, data }, done); else create.mutate({ data }, done);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{pinOnly ? `Asignar PIN a ${driver?.name}` : driver ? "Editar conductor" : "Nuevo conductor"}</DialogTitle>
          <DialogDescription>El PIN permite al conductor ingresar desde su teléfono. No se muestra después de guardarlo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          {!pinOnly && <Field label="Nombre completo" error={tried && nameErr}><Input data-testid="input-driver-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>}
          <Field label={pinRequired ? "PIN" : "Nuevo PIN (opcional)"} error={tried && pinErr} hint={!pinRequired ? "Déjelo vacío para mantener el actual." : undefined}>
            <Input data-testid="input-driver-pin" className="num tracking-[0.3em]" inputMode="numeric" type="password" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
          </Field>
          {!pinOnly && (
            <label className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm font-semibold">Habilitado para conducir</span>
              <Switch data-testid="switch-driver-active" checked={active} onCheckedChange={setActive} />
            </label>
          )}
          {(create.error || update.error) && <p className="rounded-sm border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{errMsg(create.error || update.error)}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button data-testid="button-save-driver" type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Drivers() {
  const q = useListDrivers({ query: { queryKey: getListDriversQueryKey() } });
  const update = useUpdateDriver();
  const inv = useInvalidate();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<{ d?: Driver; pinOnly?: boolean } | null>(null);
  const list = q.data ?? [];
  const toggle = (d: Driver) => update.mutate({ id: d.id, data: { name: d.name, active: !d.active } }, {
    onSuccess: () => { inv(); toast({ title: d.active ? `${d.name} deshabilitado` : `${d.name} habilitado` }); },
    onError: (e) => toast({ title: "No se pudo actualizar", description: errMsg(e), variant: "destructive" }),
  });
  return (
    <div>
      <PageHeader eyebrow="Personas" title="Conductores" desc="Solo los conductores habilitados pueden ingresar y registrar viajes."
        actions={<Button data-testid="button-new-driver" onClick={() => setDialog({})}><Plus className="mr-1.5 h-4 w-4" />Nuevo conductor</Button>} />
      {q.isLoading ? <TableSkeleton /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /> : list.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title="Sin conductores habilitados" desc="Agregue a cada persona autorizada y asígnele un PIN personal para ingresar desde Android." action={<Button onClick={() => setDialog({})}><Plus className="mr-1.5 h-4 w-4" />Agregar conductor</Button>} />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {list.map((d) => (
            <div key={d.id} data-testid={`row-driver-${d.id}`} className={`flex items-center gap-3 rounded-md border border-card-border bg-card p-3 ${d.active ? "" : "opacity-60"}`}>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-primary text-sm font-bold text-primary-foreground">{d.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{d.name}</div>
                <div className={`text-[11px] font-semibold uppercase ${d.active ? "text-ok" : "text-muted-foreground"}`}>{d.active ? "Habilitado" : "Deshabilitado"}</div>
              </div>
              <Button data-testid={`button-pin-driver-${d.id}`} size="sm" variant="ghost" onClick={() => setDialog({ d, pinOnly: true })}><KeyRound className="mr-1 h-3.5 w-3.5" />PIN</Button>
              <Button data-testid={`button-edit-driver-${d.id}`} size="sm" variant="ghost" onClick={() => setDialog({ d })}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button data-testid={`button-toggle-driver-${d.id}`} size="sm" variant="ghost" disabled={update.isPending} onClick={() => toggle(d)}><Power className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
        </div>
      )}
      {dialog && <DriverDialog driver={dialog.d} pinOnly={dialog.pinOnly} onClose={() => setDialog(null)} />}
    </div>
  );
}
