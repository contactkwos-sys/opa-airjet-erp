import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'title', header: 'Title', render: (r) => String(r.title ?? '—') },
    { key: 'severity', header: 'Severity', render: (r) => String(r.severity ?? '—') },
    { key: 'module', header: 'Module', render: (r) => String(r.module ?? '—') },
];

const fields = [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'type', label: 'Type', type: 'text', required: true },
    { name: 'severity', label: 'Severity', type: 'text', required: true },
];

const demoRows: Row[] = [
  { id: 'demo-1', title: 'Sample', severity: 'Sample', module: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="Alerts"
      subtitle="Plant-wide system and operational alerts."
      table="opa_alerts"
      moduleKey="dashboard"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
