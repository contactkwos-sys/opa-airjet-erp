import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { poFormSchema } from "@/lib/validation";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'po_number', header: 'PO #', render: (r) => String(r.po_number ?? '—') },
  { key: 'po_date', header: 'Date', render: (r) => String(r.po_date ?? '—') },
  { key: 'total_amount', header: 'Amount', render: (r) => String(r.total_amount ?? '—') },
  { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
  { key: 'remarks', header: 'Remarks', render: (r) => String(r.remarks ?? '—') },
];

const fields = [
  { name: 'po_number', label: 'PO number', type: 'text', required: true },
  { name: 'po_date', label: 'PO date', type: 'date', required: true },
  { name: 'total_amount', label: 'Total amount', type: 'number', required: true },
  { name: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'DRAFT', label: 'DRAFT' }, { value: 'SUBMITTED', label: 'SUBMITTED' }, { value: 'APPROVED', label: 'APPROVED' }, { value: 'PARTIAL', label: 'PARTIAL' }, { value: 'COMPLETED', label: 'COMPLETED' }, { value: 'CANCELLED', label: 'CANCELLED' }] },
  { name: 'remarks', label: 'Remarks', type: 'textarea' }
];

export default function Page() {
  return (
    <ModulePage
      title="Purchase Orders"
      subtitle="Approved purchase orders and values."
      table="opa_purchase_orders"
      moduleKey="purchase"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'po_date', ascending: false }}
      schema={poFormSchema}
      createDefaults={() => {
  const d = new Date().toISOString().slice(0, 10);
  return { po_date: d, po_number: `PO-${d.replace(/-/g, '')}-NEW`, status: 'DRAFT', total_amount: 0 };
}}
    />
  );
}
