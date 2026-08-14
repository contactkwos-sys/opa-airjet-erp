import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'pr_number', header: 'PR #', render: (r) => String(r.pr_number ?? '—') },
    { key: 'request_date', header: 'Date', render: (r) => String(r.request_date ?? '—') },
    { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
];

const fields = [
    { name: 'pr_number', label: 'PR number', type: 'text', required: true },
    { name: 'request_date', label: 'Date', type: 'date', required: true },
    { name: 'priority', label: 'Priority', type: 'text', required: false },
];

const demoRows: Row[] = [
  { id: 'demo-1', pr_number: 'Sample', request_date: new Date().toISOString().slice(0, 10), status: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="Requisitions"
      subtitle="Purchase requisitions awaiting action."
      table="opa_purchase_requisitions"
      moduleKey="purchase"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
