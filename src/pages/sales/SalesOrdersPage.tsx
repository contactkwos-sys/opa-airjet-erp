import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { salesOrderFormSchema } from "@/lib/validation";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'so_number', header: 'SO #', render: (r) => String(r.so_number ?? '—') },
  { key: 'so_date', header: 'Date', render: (r) => String(r.so_date ?? '—') },
  { key: 'total_amount', header: 'Amount', render: (r) => String(r.total_amount ?? '—') },
  { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
  { key: 'remarks', header: 'Remarks', render: (r) => String(r.remarks ?? '—') },
];

const fields = [
  { name: 'so_number', label: 'SO number', type: 'text', required: true },
  { name: 'so_date', label: 'Date', type: 'date', required: true },
  { name: 'total_amount', label: 'Total amount', type: 'number', required: true },
  { name: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'DRAFT', label: 'DRAFT' }, { value: 'SUBMITTED', label: 'SUBMITTED' }, { value: 'APPROVED', label: 'APPROVED' }, { value: 'PARTIAL', label: 'PARTIAL' }, { value: 'COMPLETED', label: 'COMPLETED' }, { value: 'CANCELLED', label: 'CANCELLED' }] },
  { name: 'remarks', label: 'Remarks', type: 'textarea' }
];

export default function Page() {
  return (
    <ModulePage
      title="Sales Orders"
      subtitle="Customer orders and fulfilment status."
      table="opa_sales_orders"
      moduleKey="sales"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'so_date', ascending: false }}
      schema={salesOrderFormSchema}
      createDefaults={() => {
  const d = new Date().toISOString().slice(0, 10);
  return { so_date: d, so_number: `SO-${d.replace(/-/g, '')}-NEW`, status: 'DRAFT', total_amount: 0 };
}}
    />
  );
}
