import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'yarn_code', header: 'Code', render: (r) => String(r.yarn_code ?? '—') },
    { key: 'name', header: 'Name', render: (r) => String(r.name ?? '—') },
    { key: 'current_qty', header: 'Qty', render: (r) => String(r.current_qty ?? '—') },
];

const fields = [
    { name: 'yarn_code', label: 'Yarn code', type: 'text', required: true },
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'current_qty', label: 'Qty', type: 'number', required: false },
];

const demoRows: Row[] = [
  { id: 'demo-1', yarn_code: 'Sample', name: 'Sample', current_qty: 0 },
];

export default function Page() {
  return (
    <ModulePage
      title="Yarn"
      subtitle="Yarn master stock and lots."
      table="opa_yarn_master"
      moduleKey="yarn"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
