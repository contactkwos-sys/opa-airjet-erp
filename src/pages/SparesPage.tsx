import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'part_code', header: 'Code', render: (r) => String(r.part_code ?? '—') },
    { key: 'name', header: 'Name', render: (r) => String(r.name ?? '—') },
    { key: 'current_qty', header: 'Qty', render: (r) => String(r.current_qty ?? '—') },
];

const fields = [
    { name: 'part_code', label: 'Part code', type: 'text', required: true },
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'current_qty', label: 'Qty', type: 'number', required: false },
];

const demoRows: Row[] = [
  { id: 'demo-1', part_code: 'Sample', name: 'Sample', current_qty: 0 },
];

export default function Page() {
  return (
    <ModulePage
      title="Spares"
      subtitle="Spare parts for air jet looms."
      table="opa_spare_parts"
      moduleKey="inventory"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
