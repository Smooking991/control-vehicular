const TZ = "America/Santiago";

export const fmtKm = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "—" : `${new Intl.NumberFormat("es-CL").format(Math.round(n))} km`;

export const fmtNum = (n: number | null | undefined, d = 0) =>
  n == null || Number.isNaN(n)
    ? "—"
    : new Intl.NumberFormat("es-CL", { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(n);

export const fmtCLP = (n: number | null | undefined) =>
  n == null || Number.isNaN(n)
    ? "—"
    : new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

export const fmtDateTime = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
};

export const fmtDate = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00`) : new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat("es-CL", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" }).format(d);
};

export const nowSantiago = () =>
  new Intl.DateTimeFormat("es-CL", {
    timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  }).format(new Date());

export const todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

export const toNum = (v: string) => (v.trim() === "" ? NaN : Number(v));

export function errMsg(e: unknown): string {
  const ae = e as { name?: string; status?: number; data?: unknown; message?: string } | null;
  if (ae && typeof ae === "object" && ae.name === "ApiError") {
    const d = ae.data as { message?: string; error?: string } | null;
    if (d && typeof d === "object") if (d.message || d.error) return (d.message || d.error) as string;
    if (ae.status === 401) return "Sesión no válida. Ingrese nuevamente.";
    if (ae.status === 403) return "No tiene permiso para esta acción.";
    return ae.message || "Error del servidor.";
  }
  if (e instanceof Error) return e.message;
  return "Ocurrió un error inesperado.";
}

export const STATUS_LABEL: Record<string, string> = {
  normal: "Al día", warning: "Próxima", urgent: "Urgente", overdue: "Vencida",
};
