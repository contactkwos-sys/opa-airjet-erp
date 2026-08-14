import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { beamFormSchema } from "@/lib/validation";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: "beam_number", header: "Beam #", render: (r) => String(r.beam_number ?? "—") },
  { key: "status", header: "Status", render: (r) => String(r.status ?? "—") },
  {
    key: "length_meters",
    header: "Length (M)",
    render: (r) => String(r.length_meters ?? r.total_meters ?? "—"),
  },
  { key: "remaining_meters", header: "Remaining", render: (r) => String(r.remaining_meters ?? "—") },
  { key: "loom_id", header: "Loom", render: (r) => String(r.loom_id ?? "—") },
  { key: "yarn_id", header: "Yarn", render: (r) => String(r.yarn_id ?? "—") },
];

const fields = [
  { name: "beam_number", label: "Beam number", type: "text" as const, required: true },
  {
    name: "status",
    label: "Status",
    type: "select" as const,
    required: true,
    options: [
      { value: "AVAILABLE", label: "AVAILABLE" },
      { value: "ISSUED", label: "ISSUED" },
      { value: "RUNNING", label: "RUNNING" },
      { value: "COMPLETED", label: "COMPLETED" },
      { value: "DAMAGED", label: "DAMAGED" },
      { value: "SCRAPPED", label: "SCRAPPED" },
    ],
  },
  { name: "length_meters", label: "Length meters", type: "number" as const, required: true },
  { name: "remaining_meters", label: "Remaining meters", type: "number" as const, required: true },
  { name: "loom_id", label: "Loom id (optional)", type: "text" as const },
  { name: "yarn_id", label: "Yarn id (optional)", type: "text" as const },
];

export default function BeamsPage() {
  return (
    <ModulePage
      title="Beam Store"
      subtitle="Beam lifecycle from available to running on the loom."
      table="opa_beams"
      moduleKey="inventory"
      columns={columns}
      fields={fields}
      orderBy={{ column: "beam_number", ascending: true }}
      schema={beamFormSchema}
      createDefaults={() => ({
        status: "AVAILABLE",
        length_meters: 0,
        remaining_meters: 0,
        loom_id: null,
        yarn_id: null,
      })}
    />
  );
}
