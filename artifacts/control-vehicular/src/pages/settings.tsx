import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetSettings, useUpdateSettings, useListAudit, getGetSettingsQueryKey, getListAuditQueryKey, type Audit } from "@workspace/api-client-react";
import { MailWarning, Loader2, History, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Field, ErrorState, EmptyState, TableSkeleton, Panel } from "@/components/kit";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errMsg, fmtDateTime } from "@/lib/fmt";

function parse(s: string): Record<string, unknown> | null {
  try { const v = JSON.parse(s); return v && typeof v === "object" && !Array.isArray(v) ? v : null; } catch { return null; }
}
const show = (v: unknown) => (v === undefined || v === null || v === "" ? "—" : typeof v === "boolean" ? (v ? "Sí" : "No") : typeof v === "object" ? JSON.stringify(v) : String(v));

function AuditRow({ a }: { a: Audit }) {
  const [open, setOpen] = useState(false);
  const b = parse(a.before), af = parse(a.after);
  const keys = b || af ? Array.from(new Set([...Object.keys(b ?? {}), ...Object.keys(af ?? {})])) : [];
  const changed = keys.filter((k) => JSON.stringify(b?.[k]) !== JSON.stringify(af?.[k]));
  return (
    <li data-testid={`row-audit-${a.id}`} className="border-b border-border last:border-0">
      <button onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-secondary/40">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{fmtDateTime(a.at)}</span><span className="font-semibold text-foreground">{a.actor}</span></div>
          <div className="mt-0.5 text-sm font-semibold">{a.action}</div>
          {a.reason && <div className="mt-0.5 text-sm text-muted-foreground">Motivo: {a.reason}</div>}
        </div>
        {(b || af) && <span className="num mt-1 text-[11px] text-muted-foreground">{changed.length} cambios</span>}
        <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="rise px-4 pb-4">
          {b || af ? (
            <div className="overflow-x-auto rounded-sm border border-border">
              <table className="w-full text-xs">
                <thead><tr className="bg-secondary/60 text-left uppercase tracking-wide text-muted-foreground"><th className="px-3 py-1.5">Campo</th><th className="px-3 py-1.5">Antes</th><th className="px-3 py-1.5">Después</th></tr></thead>
                <tbody>
                  {keys.map((k) => {
                    const diff = changed.includes(k);
                    return (
                      <tr key={k} className={cn("border-t border-border", diff && "bg-accent/10")}>
                        <td className="num px-3 py-1.5 font-semibold">{k}</td>
                        <td className={cn("num px-3 py-1.5", diff && "text-overdue line-through decoration-overdue/40")}>{show(b?.[k])}</td>
                        <td className={cn("num px-3 py-1.5", diff && "font-semibold text-ok")}>{show(af?.[k])}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {[["Antes", a.before], ["Después", a.after]].map(([l, v]) => (
                <div key={l}><div className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">{l}</div><pre className="num whitespace-pre-wrap break-all rounded-sm bg-secondary/60 p-2 text-xs">{v || "—"}</pre></div>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const s = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const audit = useListAudit({ query: { queryKey: getListAuditQueryKey() } });
  const save = useUpdateSettings();
  const [adminEmail, setAdminEmail] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [tried, setTried] = useState(false);
  const init = useRef(false);
  useEffect(() => {
    if (s.data && !init.current) { init.current = true; setAdminEmail(s.data.adminEmail ?? ""); setSenderEmail(s.data.senderEmail ?? ""); }
  }, [s.data]);
  const re = /^\S+@\S+\.\S+$/;
  const e1 = !re.test(adminEmail) ? "Correo inválido." : "", e2 = !re.test(senderEmail) ? "Correo inválido." : "";
  const submit = (ev: FormEvent) => {
    ev.preventDefault(); setTried(true);
    if (e1 || e2) return;
    save.mutate({ data: { adminEmail: adminEmail.trim(), senderEmail: senderEmail.trim() } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() }); qc.invalidateQueries({ queryKey: getListAuditQueryKey() }); toast({ title: "Configuración guardada" }); },
    });
  };
  return (
    <div>
      <PageHeader eyebrow="Sistema" title="Configuración" desc="Correos para alertas de mantención y registro de auditoría." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-4">
          {s.isLoading ? <Skeleton className="h-64" /> : s.isError ? <ErrorState message={errMsg(s.error)} onRetry={() => s.refetch()} /> : (
            <>
              {!s.data?.emailConnected && (
                <div data-testid="banner-email-disconnected" className="flex gap-3 rounded-md border border-warn/40 bg-warn/10 p-4">
                  <MailWarning className="h-5 w-5 shrink-0 text-warn" />
                  <div className="text-sm">
                    <div className="font-bold">Envío de correo no conectado</div>
                    <p className="mt-0.5 text-muted-foreground">Las direcciones se guardan, pero ningún correo se envía todavía. Las alertas quedan pendientes{s.data ? ` (${s.data.pendingAlerts})` : ""} hasta conectar un servicio de envío.</p>
                  </div>
                </div>
              )}
              {s.data?.emailConnected && <div className="rounded-md border border-ok/40 bg-ok/10 p-3 text-sm font-semibold text-ok">Envío de correo conectado · {s.data.pendingAlerts} alertas pendientes</div>}
              <Panel title="Correos">
                <form onSubmit={submit} noValidate className="space-y-4 p-4">
                  <Field label="Correo de administración" hint="Recibe alertas de mantención." error={tried && e1}><Input data-testid="input-admin-email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} /></Field>
                  <Field label="Correo remitente" hint="Dirección desde la que se enviarán las alertas." error={tried && e2}><Input data-testid="input-sender-email" type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} /></Field>
                  {save.isError && <p className="rounded-sm border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{errMsg(save.error)}</p>}
                  <Button data-testid="button-save-settings" type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>
                </form>
              </Panel>
            </>
          )}
        </div>
        <Panel title="Auditoría" right={<span className="num text-xs text-muted-foreground">{audit.data?.length ?? 0} eventos</span>}>
          {audit.isLoading ? <div className="p-4"><TableSkeleton /></div> : audit.isError ? <div className="p-4"><ErrorState message={errMsg(audit.error)} onRetry={() => audit.refetch()} /></div> : (audit.data ?? []).length === 0 ? (
            <div className="p-4"><EmptyState icon={<History className="h-5 w-5" />} title="Sin eventos de auditoría" desc="Correcciones de viajes y cambios administrativos quedarán registrados aquí con sus valores anteriores y nuevos." /></div>
          ) : (
            <ul>{(audit.data ?? []).map((a) => <AuditRow key={a.id} a={a} />)}</ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
