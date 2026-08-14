import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'wo_number', header: 'WO #', render: (r) => String(r.wo_number ?? '—') },
    { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
    { key: 'priority', header: 'Priority', render: (r) => String(r.priority ?? '—') },
];

const fields = [
    { name: 'wo_number', label: 'WO number', type: 'text', required: true },
    { name: 'priority', label: 'Priority', type: 'text', required: true },
    { name: 'work_description', label: 'Description', type: 'text', required: false },
];

const demoRows: Row[] = [
  { id: 'demo-1', wo_number: 'Sample', status: 'Sample', priority: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="Work Orders"
      subtitle="Maintenance work orders."
      table="opa_maintenance_work_orders"
      moduleKey="maintenance"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
