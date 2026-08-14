import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { pmFormSchema } from "@/lib/validation";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'schedule_code', header: 'Code', render: (r) => String(r.schedule_code ?? '—') },
  { key: 'name', header: 'Name', render: (r) => String(r.name ?? '—') },
  { key: 'frequency', header: 'Frequency', render: (r) => String(r.frequency ?? '—') },
  { key: 'next_due_date', header: 'Next due', render: (r) => String(r.next_due_date ?? '—') },
];

const fields = [
  { name: 'schedule_code', label: 'Schedule code', type: 'text', required: true },
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'frequency', label: 'Frequency', type: 'select', required: true, options: [{ value: 'DAILY', label: 'DAILY' }, { value: 'WEEKLY', label: 'WEEKLY' }, { value: 'MONTHLY', label: 'MONTHLY' }, { value: 'QUARTERLY', label: 'QUARTERLY' }, { value: 'HALF_YEARLY', label: 'HALF YEARLY' }, { value: 'YEARLY', label: 'YEARLY' }] },
  { name: 'next_due_date', label: 'Next due date', type: 'date', required: true }
];

export default function Page() {
  return (
    <ModulePage
      title="Preventive Maintenance"
      subtitle="PM schedules and next due dates."
      table="opa_pm_schedules"
      moduleKey="maintenance"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'next_due_date', ascending: true }}
      schema={pmFormSchema}
      createDefaults={() => ({ frequency: 'MONTHLY', next_due_date: new Date().toISOString().slice(0, 10), is_active: true })}
    />
  );
}
