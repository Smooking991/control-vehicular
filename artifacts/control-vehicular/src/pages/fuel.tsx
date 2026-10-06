import { useState } from "react";
import { ExportCsv } from "@/components/export-csv";
import { useGetFuelSummary, getGetFuelSummaryQueryKey } from "@workspace/api-client-react";
import { Fuel, Info } from "lucide-react";
import { PageHeader, ErrorState, EmptyState, TableSkeleton, Panel } from "@/components/kit";
import { FilterBar, useFilterParams, EMPTY_FILTERS, type Filters } from "@/pages/history";
import { errMsg, fmtCLP, fmtKm, fmtNum } from "@/lib/fmt";

export default function FuelPage() {
  const [f, setF] = useState<Filters>(EMPTY_FILTERS);
  const params = useFilterParams(f);
  const q = useGetFuelSummary(params, { query: { queryKey: getGetFuelSummaryQueryKey(params) } });
  const rows = q.data ?? [];
  const tot = rows.reduce((a, r) => ({ l: a.l + r.liters, c: a.c + r.cost, n: a.n + r.loads, d: a.d + r.distance }), { l: 0, c: 0, n: 0, d: 0 });
  const max = Math.max(1, ...rows.map((r) => r.cost));
  return (
    <div>
      <PageHeader eyebrow="Consumo" title="Combustible por período" desc="Totales por vehículo según los viajes registrados en el rango seleccionado."
        actions={<ExportCsv name="combustible" disabled={q.isFetching || q.isError} headers={["Patente","Litros","Costo CLP","Cantidad de cargas","Promedio litros/carga","Km recorridos","Km/litro aproximados","Desde","Hasta"]}
          rows={rows.map(r=>[r.plate,r.liters,r.cost,r.loads,r.averageLiters,r.distance,r.kmPerLiter,f.from,f.to])} />} />
      <FilterBar f={f} setF={setF} showRefuel={false} />
      <div className="mb-4 flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />El rendimiento (km/L) es aproximado: divide la distancia recorrida en el período por los litros cargados, sin considerar el nivel del estanque al inicio ni al cierre.
      </div>
      {q.isLoading ? <TableSkeleton /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /> : rows.length === 0 ? (
        <EmptyState icon={<Fuel className="h-5 w-5" />} title="Sin cargas en este período" desc="Las cargas se registran desde el formulario de viaje, marcando la opción de combustible." />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 overflow-hidden rounded-md border border-card-border bg-card lg:grid-cols-4">
            {[["Litros", `${fmtNum(tot.l, 1)} L`], ["Gasto total", fmtCLP(tot.c)], ["Cargas", fmtNum(tot.n)], ["Rendimiento aprox.", tot.l > 0 ? `≈ ${fmtNum(tot.d / tot.l, 1)} km/L` : "—"]].map(([l, v]) => (
              <div key={l} className="border-b border-r border-border p-4 last:border-r-0"><div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{l}</div><div className="num mt-1 text-xl font-semibold">{v}</div></div>
            ))}
          </div>
          <Panel>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">{["Patente", "Litros", "Gasto", "Cargas", "Prom. por carga", "Distancia", "km/L (aprox.)"].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.vehicleId} data-testid={`row-fuel-${r.vehicleId}`} className="border-b border-border/60 last:border-0">
                      <td className="num px-4 py-3 font-semibold">{r.plate}</td>
                      <td className="num px-4 py-3">{fmtNum(r.liters, 1)} L</td>
                      <td className="px-4 py-3"><div className="num">{fmtCLP(r.cost)}</div><div className="mt-1 h-1 w-28 rounded-full bg-secondary"><div className="h-full rounded-full bg-accent" style={{ width: `${(r.cost / max) * 100}%` }} /></div></td>
                      <td className="num px-4 py-3">{r.loads}</td>
                      <td className="num px-4 py-3">{fmtNum(r.averageLiters, 1)} L</td>
                      <td className="num px-4 py-3">{fmtKm(r.distance)}</td>
                      <td className="num px-4 py-3 font-semibold">{r.kmPerLiter > 0 ? `≈ ${fmtNum(r.kmPerLiter, 1)}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
