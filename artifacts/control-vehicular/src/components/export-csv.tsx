import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type Cell = string | number | boolean | null | undefined;
export function csvCell(value: Cell): string {
  let text = value == null ? "" : typeof value === "number"
    ? value.toLocaleString("es-CL", { useGrouping: false, maximumFractionDigits: 20 })
    : String(value);
  // Spreadsheet formula injection must not execute names, notes or destinations.
  if (typeof value === "string" && /^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}
export function ExportCsv({ name, headers, rows, disabled = false, label = "Exportar CSV" }: {
  name: string; headers: string[]; rows: Cell[][]; disabled?: boolean; label?: string;
}) {
  function download() {
    const content = "\uFEFF" + [headers, ...rows].map(row => row.map(csvCell).join(";")).join("\r\n") + "\r\n";
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <Button variant="outline" disabled={disabled || rows.length === 0} onClick={download} data-testid={`export-${name}`} title="CSV compatible con Excel; incluye los resultados de los filtros actuales">
    <Download className="mr-1.5 h-4 w-4" />{label}
  </Button>;
}
