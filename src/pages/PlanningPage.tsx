import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'plan_number', header: 'Plan #', render: (r) => String(r.plan_number ?? '—') },
    { key: 'plan_date', header: 'Date', render: (r) => String(r.plan_date ?? '—') },
    { key: 'planned_meter', header: 'Planned M', render: (r) => String(r.planned_meter ?? '—') },
    { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
];

const fields = [
    { name: 'plan_number', label: 'Plan number', type: 'text', required: true },
    { name: 'plan_date', label: 'Date', type: 'date', required: true },
    { name: 'planned_meter', label: 'Planned meters', type: 'number', required: true },
];

const demoRows: Row[] = [
  { id: 'demo-1', plan_number: 'Sample', plan_date: new Date().toISOString().slice(0, 10), planned_meter: 0, status: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="Planning"
      subtitle="Production plans by loom and shift."
      table="opa_production_plans"
      moduleKey="production"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
