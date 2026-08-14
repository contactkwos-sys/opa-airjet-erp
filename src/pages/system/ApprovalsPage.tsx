import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'entity_type', header: 'Entity', render: (r) => String(r.entity_type ?? '—') },
  { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
  { key: 'remarks', header: 'Remarks', render: (r) => String(r.remarks ?? '—') },
  { key: 'requested_at', header: 'Requested', render: (r) => String(r.requested_at ?? '—') },
];

const fields: import("@/components/ModulePage").ModuleField[] = [

];

export default function Page() {
  return (
    <ModulePage
      title="Approvals"
      subtitle="Pending approvals across purchase and finance."
      table="opa_approvals"
      moduleKey="approvals"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'requested_at', ascending: false }}
      readOnly
    />
  );
}
