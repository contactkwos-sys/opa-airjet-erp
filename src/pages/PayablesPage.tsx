import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'payment_number', header: 'Payment #', render: (r) => String(r.payment_number ?? '—') },
    { key: 'payment_date', header: 'Date', render: (r) => String(r.payment_date ?? '—') },
    { key: 'amount', header: 'Amount', render: (r) => String(r.amount ?? '—') },
    { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
];

const fields = [
    { name: 'payment_number', label: 'Payment number', type: 'text', required: true },
    { name: 'supplier_id', label: 'Supplier ID', type: 'text', required: true },
    { name: 'payment_date', label: 'Date', type: 'date', required: true },
    { name: 'amount', label: 'Amount', type: 'number', required: true },
];

export default function Page() {
  return (
    <ModulePage
      title="Payables"
      subtitle="Supplier payments and dues."
      table="opa_payments"
      moduleKey="accounts"
      columns={columns}
      fields={fields}
    />
  );
}
