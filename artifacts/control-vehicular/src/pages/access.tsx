import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSetupAdmin, useLogin, useListPublicDrivers, getGetSessionQueryKey, getListPublicDriversQueryKey,
  type Session,
} from "@workspace/api-client-react";
import { ShieldCheck, KeyRound, UserRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/kit";
import { cn } from "@/lib/utils";
import { errMsg } from "@/lib/fmt";

function Illustration() {
  return (
    <div className="relative hidden overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
      <svg className="absolute inset-0 h-full w-full opacity-[0.18]" viewBox="0 0 600 800" preserveAspectRatio="none" aria-hidden>
        <path d="M-20 700 C 120 640, 160 520, 280 500 S 460 380, 520 260 S 560 80, 640 40" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="10 12" />
        <path d="M-20 780 C 180 720, 240 640, 360 600 S 560 480, 640 420" fill="none" stroke="currentColor" strokeWidth="1" />
        {[120, 280, 440].map((y) => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="currentColor" strokeWidth=".5" />)}
      </svg>
      <div className="relative">
        <div className="num text-[11px] uppercase tracking-[0.2em] text-sidebar-primary">Bitácora institucional</div>
        <h2 className="mt-3 max-w-sm text-4xl font-extrabold leading-[1.05] tracking-tight text-sidebar-accent-foreground">Cada kilómetro, con nombre y hora.</h2>
        <p className="mt-4 max-w-sm text-sm text-sidebar-foreground/70">Registro de viajes, combustible y mantenciones para la flota de la institución.</p>
      </div>
      <div className="relative">
        <div className="inline-flex items-end gap-1 rounded-sm border border-sidebar-border bg-sidebar-accent/60 p-3">
          {"0128460".split("").map((d, i) => (
            <span key={i} className={cn("num grid h-12 w-8 place-items-center rounded-[3px] text-2xl font-semibold", i === 6 ? "bg-sidebar-primary text-sidebar-primary-foreground" : "bg-sidebar text-sidebar-accent-foreground")}>{d}</span>
          ))}
          <span className="num ml-2 pb-1 text-xs text-sidebar-foreground/60">km</span>
        </div>
        <p className="num mt-2 text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/45">Ilustración decorativa. No corresponde a datos reales.</p>
      </div>
    </div>
  );
}

export default function AccessPage({ session }: { session: Session }) {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.05fr_1fr]">
      <Illustration />
      <div className="flex items-center justify-center px-5 py-10">
        <div className="rise w-full max-w-sm">{session.setupRequired ? <SetupForm /> : <LoginForm />}</div>
      </div>
    </div>
  );
}

function useOnSession() {
  const qc = useQueryClient();
  const [, nav] = useLocation();
  return async (s: Session) => {
    // A pre-login session request must not overwrite the successful login.
    await qc.cancelQueries({ queryKey: getGetSessionQueryKey() });
    qc.setQueryData(getGetSessionQueryKey(), s);
    nav(s.role === "driver" ? "/viajes/nuevo" : "/");
  };
}

function SetupForm() {
  const onSession = useOnSession();
  const setup = useSetupAdmin({ mutation: { onSuccess: onSession } });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [tried, setTried] = useState(false);
  const errs = {
    name: !name.trim() && "Ingrese su nombre.",
    email: !/^\S+@\S+\.\S+$/.test(email) && "Ingrese un correo válido.",
    pin: !/^\d{6,12}$/.test(pin) && "El PIN debe tener entre 6 y 12 dígitos.",
    pin2: pin !== pin2 && "Los PIN no coinciden.",
  };
  const valid = !Object.values(errs).some(Boolean);
  const submit = (e: FormEvent) => {
    e.preventDefault(); setTried(true);
    if (valid) setup.mutate({ data: { name: name.trim(), email: email.trim(), pin } });
  };
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <div className="mb-4 grid h-11 w-11 place-items-center rounded-sm bg-primary text-primary-foreground"><ShieldCheck className="h-5 w-5" /></div>
        <p className="num text-[11px] uppercase tracking-[0.18em] text-accent">Configuración inicial</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Cree la cuenta de administración</h1>
        <p className="mt-2 text-sm text-muted-foreground">Este paso se realiza una sola vez. La persona que lo complete administrará vehículos, conductores y correcciones.</p>
      </div>
      <Field label="Nombre completo" error={tried && errs.name}><Input data-testid="input-setup-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
      <Field label="Correo institucional" error={tried && errs.email}><Input data-testid="input-setup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="PIN" error={tried && errs.pin}><Input data-testid="input-setup-pin" type="password" inputMode="numeric" maxLength={12} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} autoComplete="new-password" /></Field>
        <Field label="Repetir PIN" error={tried && errs.pin2}><Input data-testid="input-setup-pin2" type="password" inputMode="numeric" maxLength={12} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))} autoComplete="new-password" /></Field>
      </div>
      {setup.isError && <p className="rounded-sm border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{errMsg(setup.error)}</p>}
      <Button data-testid="button-setup" type="submit" className="h-11 w-full font-bold" disabled={setup.isPending}>
        {setup.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crear administrador
      </Button>
    </form>
  );
}

function LoginForm() {
  const onSession = useOnSession();
  const login = useLogin({ mutation: { onSuccess: onSession } });
  const [role, setRole] = useState<"driver" | "admin">("driver");
  const [driverId, setDriverId] = useState("");
  const [pin, setPin] = useState("");
  const drivers = useListPublicDrivers({ query: { queryKey: getListPublicDriversQueryKey(), enabled: role === "driver" } });
  const active = (drivers.data ?? []).filter((d) => d.active);
  const canSubmit = pin.length > 0 && (role === "admin" || !!driverId);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    login.mutate({ data: role === "driver" ? { role, driverId: Number(driverId), pin } : { role, pin } });
  };
  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <p className="num text-[11px] uppercase tracking-[0.18em] text-accent">Acceso</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Control Vehicular</h1>
        <p className="mt-1 text-sm text-muted-foreground">Identifíquese para continuar.</p>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-secondary p-1">
        {([["driver", "Conductor", UserRound], ["admin", "Administración", KeyRound]] as const).map(([r, l, Icon]) => (
          <button key={r} type="button" data-testid={`button-role-${r}`} onClick={() => { setRole(r); login.reset(); }}
            className={cn("flex items-center justify-center gap-2 rounded-sm py-2.5 text-sm font-semibold transition-all", role === r ? "bg-card shadow-sm text-foreground" : "text-muted-foreground")}>
            <Icon className="h-4 w-4" />{l}
          </button>
        ))}
      </div>
      {role === "driver" && (
        <Field label="Conductor" error={drivers.isError && errMsg(drivers.error)} hint={drivers.isSuccess && active.length === 0 ? "Aún no hay conductores habilitados. Solicítelo a administración." : undefined}>
          <NativeSelect data-testid="select-login-driver" className="h-12 text-base" value={driverId} onChange={(e) => setDriverId(e.target.value)} disabled={drivers.isLoading}>
            <option value="">{drivers.isLoading ? "Cargando…" : "Seleccione su nombre"}</option>
            {active.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </NativeSelect>
        </Field>
      )}
      <Field label="PIN">
        <Input data-testid="input-login-pin" type="password" inputMode={role === "driver" ? "numeric" : undefined} className="num h-12 text-lg tracking-[0.3em]" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="current-password" />
      </Field>
      {login.isError && <p data-testid="text-login-error" className="rounded-sm border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{errMsg(login.error)}</p>}
      <Button data-testid="button-login" type="submit" className="h-12 w-full text-base font-bold" disabled={!canSubmit || login.isPending}>
        {login.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ingresar
      </Button>
    </form>
  );
}
