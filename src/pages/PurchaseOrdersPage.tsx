import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'po_number', header: 'PO #', render: (r) => String(r.po_number ?? '—') },
    { key: 'po_date', header: 'Date', render: (r) => String(r.po_date ?? '—') },
    { key: 'total_amount', header: 'Amount', render: (r) => String(r.total_amount ?? '—') },
    { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
];

const fields = [
    { name: 'po_number', label: 'PO number', type: 'text', required: true },
    { name: 'supplier_id', label: 'Supplier ID', type: 'text', required: true },
    { name: 'po_date', label: 'Date', type: 'date', required: true },
    { name: 'total_amount', label: 'Amount', type: 'number', required: false },
];

const demoRows: Row[] = [
  { id: 'demo-1', po_number: 'Sample', po_date: new Date().toISOString().slice(0, 10), total_amount: 0, status: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="Purchase Orders"
      subtitle="Supplier purchase orders."
      table="opa_purchase_orders"
      moduleKey="purchase"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
