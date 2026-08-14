import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'loom_id', header: 'Loom', render: (r) => String(r.loom_id ?? '—') },
    { key: 'reason', header: 'Reason', render: (r) => String(r.reason ?? '—') },
    { key: 'start_time', header: 'Start', render: (r) => String(r.start_time ?? '—') },
];

const fields = [
    { name: 'loom_id', label: 'Loom ID', type: 'text', required: true },
    { name: 'reason', label: 'Reason', type: 'text', required: true },
    { name: 'start_time', label: 'Start time', type: 'text', required: true },
];

const demoRows: Row[] = [
  { id: 'demo-1', loom_id: 'Sample', reason: 'Sample', start_time: new Date().toISOString().slice(0, 10) },
];

export default function Page() {
  return (
    <ModulePage
      title="Stoppages"
      subtitle="Loom downtime and stoppage reasons."
      table="opa_loom_stoppages"
      moduleKey="production"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
