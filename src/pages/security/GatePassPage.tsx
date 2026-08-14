import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'pass_number', header: 'Pass #', render: (r) => String(r.pass_number ?? '—') },
    { key: 'pass_type', header: 'Type', render: (r) => String(r.pass_type ?? '—') },
    { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
];

const fields = [
    { name: 'pass_number', label: 'Pass number', type: 'text', required: true },
    { name: 'pass_type', label: 'Pass type', type: 'text', required: true },
    { name: 'purpose', label: 'Purpose', type: 'text', required: false },
];

const demoRows: Row[] = [
  { id: 'demo-1', pass_number: 'Sample', pass_type: 'Sample', status: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="Gate Pass"
      subtitle="Visitor and material gate passes."
      table="opa_gate_passes"
      moduleKey="security"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
