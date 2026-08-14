import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'action', header: 'Action', render: (r) => String(r.action ?? '—') },
  { key: 'module', header: 'Module', render: (r) => String(r.module ?? '—') },
  { key: 'user_name', header: 'User', render: (r) => String(r.user_name ?? '—') },
  { key: 'record_id', header: 'Record', render: (r) => String(r.record_id ?? '—') },
  { key: 'created_at', header: 'When', render: (r) => String(r.created_at ?? '—') },
];

const fields: import("@/components/ModulePage").ModuleField[] = [

];

export default function Page() {
  return (
    <ModulePage
      title="Audit Log"
      subtitle="Immutable activity trail across modules."
      table="opa_audit_logs"
      moduleKey="audit"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'created_at', ascending: false }}
      readOnly
    />
  );
}
