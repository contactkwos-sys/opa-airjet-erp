import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { greigeFormSchema } from "@/lib/validation";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'lot_number', header: 'Lot', render: (r) => String(r.lot_number ?? '—') },
  { key: 'meters', header: 'Meters', render: (r) => String(r.meters ?? '—') },
  { key: 'quality_grade', header: 'Grade', render: (r) => String(r.quality_grade ?? '—') },
  { key: 'location', header: 'Location', render: (r) => String(r.location ?? '—') },
  { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
];

const fields = [
  { name: 'lot_number', label: 'Lot number', type: 'text', required: true },
  { name: 'meters', label: 'Meters', type: 'number', required: true },
  { name: 'quality_grade', label: 'Grade', type: 'text', required: true },
  { name: 'location', label: 'Location', type: 'text' },
  { name: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'AVAILABLE', label: 'AVAILABLE' }, { value: 'QC_HOLD', label: 'QC HOLD' }, { value: 'RESERVED', label: 'RESERVED' }, { value: 'DISPATCHED', label: 'DISPATCHED' }] }
];

export default function Page() {
  return (
    <ModulePage
      title="Greige"
      subtitle="Greige stock lots and QC hold status."
      table="opa_greige_stock"
      moduleKey="inventory"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'lot_number', ascending: true }}
      schema={greigeFormSchema}
      createDefaults={() => ({ status: 'AVAILABLE', quality_grade: 'A', meters: 0, location: 'GREIGE STORE' })}
    />
  );
}
