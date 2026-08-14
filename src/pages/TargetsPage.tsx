import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'target_type', header: 'Type', render: (r) => String(r.target_type ?? '—') },
    { key: 'target_date', header: 'Date', render: (r) => String(r.target_date ?? '—') },
    { key: 'target_meter', header: 'Target M', render: (r) => String(r.target_meter ?? '—') },
];

const fields = [
    { name: 'target_type', label: 'Target type', type: 'text', required: true },
    { name: 'target_date', label: 'Date', type: 'date', required: true },
    { name: 'target_meter', label: 'Target meters', type: 'number', required: true },
];

const demoRows: Row[] = [
  { id: 'demo-1', target_type: 'Sample', target_date: new Date().toISOString().slice(0, 10), target_meter: 0 },
];

export default function Page() {
  return (
    <ModulePage
      title="Targets"
      subtitle="Daily, shift, and loom production targets."
      table="opa_production_targets"
      moduleKey="production"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
