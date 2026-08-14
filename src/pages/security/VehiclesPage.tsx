import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { vehicleFormSchema } from "@/lib/validation";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: "entry_number", header: "Entry #", render: (r) => String(r.entry_number ?? "—") },
  { key: "vehicle_number", header: "Vehicle", render: (r) => String(r.vehicle_number ?? "—") },
  { key: "driver_name", header: "Driver", render: (r) => String(r.driver_name ?? "—") },
  { key: "purpose", header: "Purpose", render: (r) => String(r.purpose ?? "—") },
  { key: "direction", header: "Direction", render: (r) => String(r.direction ?? "—") },
  { key: "entry_at", header: "Entry", render: (r) => String(r.entry_at ?? "—") },
  { key: "exit_at", header: "Exit", render: (r) => String(r.exit_at ?? "—") },
];

const fields = [
  { name: "entry_number", label: "Entry number", type: "text" as const, required: true },
  { name: "vehicle_number", label: "Vehicle number", type: "text" as const, required: true },
  { name: "driver_name", label: "Driver name", type: "text" as const, required: true },
  { name: "purpose", label: "Purpose", type: "text" as const, required: true },
  {
    name: "direction",
    label: "Direction",
    type: "select" as const,
    required: true,
    options: [
      { value: "INWARD", label: "INWARD" },
      { value: "OUTWARD", label: "OUTWARD" },
    ],
  },
];

export default function Page() {
  return (
    <ModulePage
      title="Vehicles"
      subtitle="Vehicle inward/outward log at the gate."
      table="opa_vehicle_entries"
      moduleKey="security"
      columns={columns}
      fields={fields}
      orderBy={{ column: "entry_at", ascending: false }}
      schema={vehicleFormSchema}
      createDefaults={() => {
        const d = new Date().toISOString().slice(0, 10);
        return {
          entry_number: `VE-${d.replace(/-/g, "")}-NEW`,
          direction: "INWARD",
          entry_at: new Date().toISOString(),
        };
      }}
    />
  );
}
