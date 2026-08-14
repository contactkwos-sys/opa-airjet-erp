import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'request_number', header: 'Request #', render: (r) => String(r.request_number ?? '—') },
    { key: 'visitor_name', header: 'Visitor', render: (r) => String(r.visitor_name ?? '—') },
    { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
];

const fields = [
    { name: 'request_number', label: 'Request number', type: 'text', required: true },
    { name: 'visitor_name', label: 'Visitor name', type: 'text', required: true },
    { name: 'purpose', label: 'Purpose', type: 'text', required: true },
];

const demoRows: Row[] = [
  { id: 'demo-1', request_number: 'Sample', visitor_name: 'Sample', status: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="CEO Visits"
      subtitle="CEO visit approval workflow."
      table="opa_ceo_visit_requests"
      moduleKey="security"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
