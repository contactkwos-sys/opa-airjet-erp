import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'lot_number', header: 'Lot', render: (r) => String(r.lot_number ?? '—') },
    { key: 'meters', header: 'Meters', render: (r) => String(r.meters ?? '—') },
    { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
];

const fields = [
    { name: 'lot_number', label: 'Lot number', type: 'text', required: true },
    { name: 'meters', label: 'Meters', type: 'number', required: true },
    { name: 'status', label: 'Status', type: 'text', required: true },
];

const demoRows: Row[] = [
  { id: 'demo-1', lot_number: 'Sample', meters: 0, status: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="Greige"
      subtitle="Greige fabric lots and stock."
      table="opa_greige_stock"
      moduleKey="inventory"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
