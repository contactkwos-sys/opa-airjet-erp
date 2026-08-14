import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { yarnFormSchema } from "@/lib/validation";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: "yarn_code", header: "Code", render: (r) => String(r.yarn_code ?? "—") },
  { key: "name", header: "Name", render: (r) => String(r.name ?? "—") },
  { key: "count", header: "Count", render: (r) => String(r.count ?? "—") },
  { key: "blend", header: "Blend", render: (r) => String(r.blend ?? "—") },
  { key: "color", header: "Color", render: (r) => String(r.color ?? "—") },
  { key: "current_qty", header: "Qty", render: (r) => String(r.current_qty ?? "—") },
  { key: "uom", header: "UOM", render: (r) => String(r.uom ?? "KG") },
];

const fields = [
  { name: "yarn_code", label: "Yarn code", type: "text" as const, required: true },
  { name: "name", label: "Name", type: "text" as const, required: true },
  { name: "count", label: "Count", type: "text" as const },
  { name: "blend", label: "Blend", type: "text" as const },
  { name: "color", label: "Color", type: "text" as const },
  { name: "uom", label: "UOM", type: "text" as const, required: true },
  { name: "current_qty", label: "Current qty", type: "number" as const },
  { name: "unit_cost", label: "Unit cost", type: "number" as const },
];

export default function YarnPage() {
  return (
    <ModulePage
      title="Yarn Store"
      subtitle="Yarn master — counts, blend, color and stock for warp/weft planning."
      table="opa_yarn_master"
      moduleKey="yarn"
      columns={columns}
      fields={fields}
      orderBy={{ column: "yarn_code", ascending: true }}
      schema={yarnFormSchema}
      createDefaults={() => ({
        uom: "KG",
        color: "",
        current_qty: 0,
        unit_cost: 0,
        is_active: true,
      })}
    />
  );
}
