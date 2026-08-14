import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'module', header: 'Module', render: (r) => String(r.module ?? '—') },
    { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
    { key: 'level', header: 'Level', render: (r) => String(r.level ?? '—') },
];

const fields = [
    { name: 'module', label: 'Module', type: 'text', required: true },
    { name: 'record_id', label: 'Record ID', type: 'text', required: true },
    { name: 'level', label: 'Level', type: 'number', required: false },
];

const demoRows: Row[] = [
  { id: 'demo-1', module: 'Sample', status: 'Sample', level: 0 },
];

export default function Page() {
  return (
    <ModulePage
      title="Approvals"
      subtitle="Pending multi-level approvals."
      table="opa_approvals"
      moduleKey="approvals"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
