import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'incident_number', header: 'Incident #', render: (r) => String(r.incident_number ?? '—') },
    { key: 'title', header: 'Title', render: (r) => String(r.title ?? '—') },
    { key: 'severity', header: 'Severity', render: (r) => String(r.severity ?? '—') },
    { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
];

const fields = [
    { name: 'incident_number', label: 'Incident number', type: 'text', required: true },
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'severity', label: 'Severity', type: 'text', required: true },
];

const demoRows: Row[] = [
  { id: 'demo-1', incident_number: 'Sample', title: 'Sample', severity: 'Sample', status: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="Incidents"
      subtitle="Security incidents and resolutions."
      table="opa_security_incidents"
      moduleKey="security"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
