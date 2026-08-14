import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { dispatchFormSchema } from "@/lib/validation";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: "dispatch_number", header: "Dispatch #", render: (r) => String(r.dispatch_number ?? "—") },
  { key: "dispatch_date", header: "Date", render: (r) => String(r.dispatch_date ?? "—") },
  { key: "vehicle_number", header: "Vehicle", render: (r) => String(r.vehicle_number ?? "—") },
  { key: "meters", header: "Meters", render: (r) => String(r.meters ?? "—") },
  { key: "status", header: "Status", render: (r) => String(r.status ?? "—") },
];

const fields = [
  { name: "dispatch_number", label: "Dispatch number", type: "text" as const, required: true },
  { name: "dispatch_date", label: "Date", type: "date" as const, required: true },
  { name: "vehicle_number", label: "Vehicle number", type: "text" as const, required: true },
  {
    name: "status",
    label: "Status",
    type: "select" as const,
    required: true,
    options: [
      { value: "DRAFT", label: "DRAFT" },
      { value: "COMPLETED", label: "COMPLETED" },
      { value: "CANCELLED", label: "CANCELLED" },
    ],
  },
  { name: "remarks", label: "Remarks", type: "textarea" as const },
];

export default function Page() {
  return (
    <ModulePage
      title="Dispatch"
      subtitle="Outbound greige and fabric dispatches."
      table="opa_dispatches"
      moduleKey="sales"
      columns={columns}
      fields={fields}
      orderBy={{ column: "dispatch_date", ascending: false }}
      schema={dispatchFormSchema}
      createDefaults={() => {
        const d = new Date().toISOString().slice(0, 10);
        return {
          dispatch_date: d,
          dispatch_number: `DSP-${d.replace(/-/g, "")}-NEW`,
          status: "DRAFT",
        };
      }}
    />
  );
}
