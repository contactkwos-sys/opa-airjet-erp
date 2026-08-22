import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'receipt_number', header: 'Receipt #', render: (r) => String(r.receipt_number ?? '—') },
    { key: 'receipt_date', header: 'Date', render: (r) => String(r.receipt_date ?? '—') },
    { key: 'amount', header: 'Amount', render: (r) => String(r.amount ?? '—') },
    { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
];

const fields = [
    { name: 'receipt_number', label: 'Receipt number', type: 'text', required: true },
    { name: 'customer_id', label: 'Customer ID', type: 'text', required: true },
    { name: 'receipt_date', label: 'Date', type: 'date', required: true },
    { name: 'amount', label: 'Amount', type: 'number', required: true },
];

export default function Page() {
  return (
    <ModulePage
      title="Receivables"
      subtitle="Customer receipts and outstanding."
      table="opa_receipts"
      moduleKey="accounts"
      columns={columns}
      fields={fields}
    />
  );
}
