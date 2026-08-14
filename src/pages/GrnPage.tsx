import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'grn_number', header: 'GRN #', render: (r) => String(r.grn_number ?? '—') },
    { key: 'grn_date', header: 'Date', render: (r) => String(r.grn_date ?? '—') },
    { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
];

const fields = [
    { name: 'grn_number', label: 'GRN number', type: 'text', required: true },
    { name: 'grn_date', label: 'Date', type: 'date', required: true },
];

const demoRows: Row[] = [
  { id: 'demo-1', grn_number: 'Sample', grn_date: new Date().toISOString().slice(0, 10), status: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="GRN"
      subtitle="Goods receipt notes against POs."
      table="opa_grns"
      moduleKey="purchase"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
