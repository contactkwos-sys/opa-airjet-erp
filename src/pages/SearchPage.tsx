import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'loom_number', header: 'Result', render: (r) => String(r.loom_number ?? '—') },
    { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
];

const fields = [
    { name: 'loom_number', label: 'Query / loom #', type: 'text', required: true },
];

const demoRows: Row[] = [
  { id: 'demo-1', loom_number: 'Sample', status: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="Search"
      subtitle="Global search across ERP modules."
      table="opa_looms"
      moduleKey="search"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
