import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { workOrderFormSchema } from "@/lib/validation";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'wo_number', header: 'WO #', render: (r) => String(r.wo_number ?? '—') },
  { key: 'work_description', header: 'Work', render: (r) => String(r.work_description ?? '—') },
  { key: 'priority', header: 'Priority', render: (r) => String(r.priority ?? '—') },
  { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
  { key: 'labour_hours', header: 'Hours', render: (r) => String(r.labour_hours ?? '—') },
];

const fields = [
  { name: 'wo_number', label: 'WO number', type: 'text', required: true },
  { name: 'work_description', label: 'Work description', type: 'textarea', required: true },
  { name: 'priority', label: 'Priority', type: 'select', required: true, options: [{ value: 'LOW', label: 'LOW' }, { value: 'MEDIUM', label: 'MEDIUM' }, { value: 'HIGH', label: 'HIGH' }, { value: 'CRITICAL', label: 'CRITICAL' }] },
  { name: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'OPEN', label: 'OPEN' }, { value: 'ASSIGNED', label: 'ASSIGNED' }, { value: 'IN_PROGRESS', label: 'IN PROGRESS' }, { value: 'ON_HOLD', label: 'ON HOLD' }, { value: 'COMPLETED', label: 'COMPLETED' }, { value: 'CANCELLED', label: 'CANCELLED' }, { value: 'CLOSED', label: 'CLOSED' }] }
];

export default function Page() {
  return (
    <ModulePage
      title="Work Orders"
      subtitle="Assigned maintenance jobs and resolutions."
      table="opa_maintenance_work_orders"
      moduleKey="maintenance"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'created_at', ascending: false }}
      schema={workOrderFormSchema}
      createDefaults={() => {
  const d = new Date().toISOString().slice(0, 10);
  return { wo_number: `WO-${d.replace(/-/g, '')}-NEW`, priority: 'MEDIUM', status: 'OPEN' };
}}
    />
  );
}
