import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'item_code', header: 'Code', render: (r) => String(r.item_code ?? '—') },
    { key: 'name', header: 'Name', render: (r) => String(r.name ?? '—') },
    { key: 'current_qty', header: 'Qty', render: (r) => String(r.current_qty ?? '—') },
];

const fields = [
    { name: 'item_code', label: 'Item code', type: 'text', required: true },
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'current_qty', label: 'Qty', type: 'number', required: false },
    { name: 'uom', label: 'UOM', type: 'text', required: false },
];

const demoRows: Row[] = [
  { id: 'demo-1', item_code: 'Sample', name: 'Sample', current_qty: 0 },
];

export default function Page() {
  return (
    <ModulePage
      title="Inventory"
      subtitle="General stores and stock levels."
      table="opa_inventory_items"
      moduleKey="inventory"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
