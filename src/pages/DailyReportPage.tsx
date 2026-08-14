import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'entry_number', header: 'Entry #', render: (r) => String(r.entry_number ?? '—') },
    { key: 'entry_date', header: 'Date', render: (r) => String(r.entry_date ?? '—') },
    { key: 'production_meter', header: 'Meters', render: (r) => String(r.production_meter ?? '—') },
];

const fields = [
    { name: 'entry_number', label: 'Entry number', type: 'text', required: true },
    { name: 'entry_date', label: 'Date', type: 'date', required: true },
    { name: 'production_meter', label: 'Meters', type: 'number', required: true },
];

const demoRows: Row[] = [
  { id: 'demo-1', entry_number: 'Sample', entry_date: new Date().toISOString().slice(0, 10), production_meter: 0 },
];

export default function Page() {
  return (
    <ModulePage
      title="Daily Report"
      subtitle="Shift and day-end production summary."
      table="opa_production_entries"
      moduleKey="production"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
