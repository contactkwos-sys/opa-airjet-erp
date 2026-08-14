import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'so_number', header: 'SO #', render: (r) => String(r.so_number ?? '—') },
    { key: 'so_date', header: 'Date', render: (r) => String(r.so_date ?? '—') },
    { key: 'total_amount', header: 'Amount', render: (r) => String(r.total_amount ?? '—') },
    { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
];

const fields = [
    { name: 'so_number', label: 'SO number', type: 'text', required: true },
    { name: 'customer_id', label: 'Customer ID', type: 'text', required: true },
    { name: 'so_date', label: 'Date', type: 'date', required: true },
    { name: 'total_amount', label: 'Amount', type: 'number', required: false },
];

const demoRows: Row[] = [
  { id: 'demo-1', so_number: 'Sample', so_date: new Date().toISOString().slice(0, 10), total_amount: 0, status: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="Sales Orders"
      subtitle="Customer sales orders."
      table="opa_sales_orders"
      moduleKey="sales"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
