import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { StatusBadge } from "@/components/ui";
import { greigeFormSchema } from "@/lib/validation";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: "lot_number", header: "Lot", render: (r) => String(r.lot_number ?? "—") },
  { key: "meters", header: "Meters", render: (r) => String(r.meters ?? "—") },
  { key: "kg", header: "Kg", render: (r) => String(r.kg ?? "—") },
  {
    key: "quality_grade",
    header: "Grade",
    render: (r) => String(r.quality_grade ?? "—"),
  },
  {
    key: "status",
    header: "Status",
    render: (r) => <StatusBadge status={String(r.status ?? "AVAILABLE")} />,
  },
  { key: "remarks", header: "Remarks", render: (r) => String(r.remarks ?? r.location ?? "—") },
];

const fields = [
  { name: "lot_number", label: "Lot number", type: "text" as const, required: true },
  { name: "meters", label: "Meters", type: "number" as const, required: true },
  { name: "kg", label: "Kg", type: "number" as const },
  { name: "quality_grade", label: "Grade", type: "text" as const, required: true },
  {
    name: "status",
    label: "Status",
    type: "select" as const,
    required: true,
    options: [
      { value: "AVAILABLE", label: "AVAILABLE" },
      { value: "QC_HOLD", label: "QC HOLD" },
      { value: "RESERVED", label: "RESERVED" },
      { value: "DISPATCHED", label: "DISPATCHED" },
    ],
  },
  { name: "remarks", label: "Remarks / location", type: "textarea" as const },
];

export default function GreigePage() {
  return (
    <ModulePage
      title="Greige"
      subtitle="Greige stock lots and QC hold status."
      table="opa_greige_stock"
      moduleKey="inventory"
      columns={columns}
      fields={fields}
      orderBy={{ column: "lot_number", ascending: true }}
      schema={greigeFormSchema}
      createDefaults={() => ({
        status: "AVAILABLE",
        quality_grade: "A",
        meters: 0,
        kg: 0,
      })}
    />
  );
}
