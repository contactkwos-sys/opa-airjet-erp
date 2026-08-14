import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'schedule_code', header: 'Code', render: (r) => String(r.schedule_code ?? '—') },
    { key: 'name', header: 'Name', render: (r) => String(r.name ?? '—') },
    { key: 'next_due_date', header: 'Next due', render: (r) => String(r.next_due_date ?? '—') },
];

const fields = [
    { name: 'schedule_code', label: 'Schedule code', type: 'text', required: true },
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'frequency', label: 'Frequency', type: 'text', required: true },
    { name: 'next_due_date', label: 'Next due', type: 'date', required: false },
];

const demoRows: Row[] = [
  { id: 'demo-1', schedule_code: 'Sample', name: 'Sample', next_due_date: new Date().toISOString().slice(0, 10) },
];

export default function Page() {
  return (
    <ModulePage
      title="Preventive Maintenance"
      subtitle="PM schedules and due dates."
      table="opa_pm_schedules"
      moduleKey="maintenance"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
