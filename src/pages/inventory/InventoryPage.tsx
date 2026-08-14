import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { inventoryItemFormSchema } from "@/lib/validation";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'item_code', header: 'Code', render: (r) => String(r.item_code ?? '—') },
  { key: 'name', header: 'Name', render: (r) => String(r.name ?? '—') },
  { key: 'category', header: 'Category', render: (r) => String(r.category ?? '—') },
  { key: 'uom', header: 'UOM', render: (r) => String(r.uom ?? '—') },
  { key: 'reorder_level', header: 'Reorder', render: (r) => String(r.reorder_level ?? '—') },
];

const fields = [
  { name: 'item_code', label: 'Item code', type: 'text', required: true },
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'category', label: 'Category', type: 'select', required: true, options: [{ value: 'YARN', label: 'YARN' }, { value: 'SPARES', label: 'SPARES' }, { value: 'GENERAL', label: 'GENERAL' }, { value: 'CONSUMABLE', label: 'CONSUMABLE' }] },
  { name: 'uom', label: 'UOM', type: 'text', required: true },
  { name: 'reorder_level', label: 'Reorder level', type: 'number' }
];

export default function Page() {
  return (
    <ModulePage
      title="Inventory"
      subtitle="Stores items, reorder levels and stock masters."
      table="opa_inventory_items"
      moduleKey="inventory"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'item_code', ascending: true }}
      schema={inventoryItemFormSchema}
      createDefaults={() => ({ uom: 'PCS', category: 'GENERAL', reorder_level: 0, is_active: true })}
    />
  );
}
