import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'visitor_code', header: 'Code', render: (r) => String(r.visitor_code ?? '—') },
    { key: 'full_name', header: 'Name', render: (r) => String(r.full_name ?? '—') },
    { key: 'company', header: 'Company', render: (r) => String(r.company ?? '—') },
];

const fields = [
    { name: 'visitor_code', label: 'Visitor code', type: 'text', required: true },
    { name: 'full_name', label: 'Full name', type: 'text', required: true },
    { name: 'mobile', label: 'Mobile', type: 'text', required: false },
    { name: 'company', label: 'Company', type: 'text', required: false },
];

const demoRows: Row[] = [
  { id: 'demo-1', visitor_code: 'Sample', full_name: 'Sample', company: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="Visitors"
      subtitle="Visitor register."
      table="opa_visitors"
      moduleKey="security"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
