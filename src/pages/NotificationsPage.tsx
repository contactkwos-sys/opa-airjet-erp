import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'title', header: 'Title', render: (r) => String(r.title ?? '—') },
    { key: 'type', header: 'Type', render: (r) => String(r.type ?? '—') },
    { key: 'is_read', header: 'Read', render: (r) => String(r.is_read ?? '') },
];

const fields = [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'body', label: 'Body', type: 'text', required: false },
    { name: 'type', label: 'Type', type: 'text', required: true },
];

const demoRows: Row[] = [
  { id: 'demo-1', title: 'Sample', type: 'Sample', is_read: false },
];

export default function Page() {
  return (
    <ModulePage
      title="Notifications"
      subtitle="In-app notification centre."
      table="opa_notifications"
      moduleKey="notifications"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
