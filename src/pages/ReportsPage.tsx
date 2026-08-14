import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'entry_number', header: 'Ref', render: (r) => String(r.entry_number ?? '—') },
    { key: 'entry_date', header: 'Date', render: (r) => String(r.entry_date ?? '—') },
];

const fields = [
    { name: 'entry_number', label: 'Report ref', type: 'text', required: true },
    { name: 'entry_date', label: 'Date', type: 'date', required: true },
];

const demoRows: Row[] = [
  { id: 'demo-1', entry_number: 'Sample', entry_date: new Date().toISOString().slice(0, 10) },
];

export default function Page() {
  return (
    <ModulePage
      title="Reports"
      subtitle="Operational and executive reports hub."
      table="opa_production_entries"
      moduleKey="reports"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
