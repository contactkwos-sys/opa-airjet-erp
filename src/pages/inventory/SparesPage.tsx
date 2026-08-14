import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { spareFormSchema } from "@/lib/validation";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: "part_code", header: "Code", render: (r) => String(r.part_code ?? "—") },
  { key: "name", header: "Name", render: (r) => String(r.name ?? r.part_name ?? "—") },
  { key: "current_qty", header: "Stock", render: (r) => String(r.current_qty ?? r.current_stock ?? "—") },
  { key: "reorder_level", header: "Reorder", render: (r) => String(r.reorder_level ?? "—") },
  { key: "uom", header: "UOM", render: (r) => String(r.uom ?? "—") },
];

const fields = [
  { name: "part_code", label: "Part code", type: "text" as const, required: true },
  { name: "name", label: "Name", type: "text" as const, required: true },
  { name: "current_qty", label: "Current stock", type: "number" as const, required: true },
  { name: "reorder_level", label: "Reorder level", type: "number" as const, required: true },
  { name: "uom", label: "UOM", type: "text" as const, required: true },
];

export default function Page() {
  return (
    <ModulePage
      title="Spares"
      subtitle="Spare parts stock and reorder alerts."
      table="opa_spare_parts"
      moduleKey="inventory"
      columns={columns}
      fields={fields}
      orderBy={{ column: "part_code", ascending: true }}
      schema={spareFormSchema}
      createDefaults={() => ({
        uom: "PCS",
        current_qty: 0,
        reorder_level: 0,
        is_active: true,
      })}
    />
  );
}
