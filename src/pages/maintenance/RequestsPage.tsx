import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'request_number', header: 'Request #', render: (r) => String(r.request_number ?? '—') },
    { key: 'description', header: 'Issue', render: (r) => String(r.description ?? '—') },
    { key: 'priority', header: 'Priority', render: (r) => String(r.priority ?? '—') },
    { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
];

const fields = [
    { name: 'request_number', label: 'Request number', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'text', required: true },
    { name: 'priority', label: 'Priority', type: 'text', required: true },
];

const demoRows: Row[] = [
  { id: 'demo-1', request_number: 'Sample', description: 'Sample', priority: 'Sample', status: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="Maintenance Requests"
      subtitle="Breakdown and service requests."
      table="opa_maintenance_requests"
      moduleKey="maintenance"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
