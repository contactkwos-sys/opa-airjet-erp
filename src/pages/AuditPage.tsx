import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'action', header: 'Action', render: (r) => String(r.action ?? '—') },
    { key: 'module', header: 'Module', render: (r) => String(r.module ?? '—') },
    { key: 'user_name', header: 'User', render: (r) => String(r.user_name ?? '—') },
    { key: 'created_at', header: 'When', render: (r) => String(r.created_at ?? '—') },
];

const fields = [
    { name: 'action', label: 'Action', type: 'text', required: true },
    { name: 'module', label: 'Module', type: 'text', required: true },
    { name: 'user_name', label: 'User', type: 'text', required: false },
];

const demoRows: Row[] = [
  { id: 'demo-1', action: 'Sample', module: 'Sample', user_name: 'Sample', created_at: new Date().toISOString().slice(0, 10) },
];

export default function Page() {
  return (
    <ModulePage
      title="Audit Log"
      subtitle="Immutable activity trail."
      table="opa_audit_logs"
      moduleKey="audit"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
