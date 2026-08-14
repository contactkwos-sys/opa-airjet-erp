import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { prFormSchema } from "@/lib/validation";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'pr_number', header: 'PR #', render: (r) => String(r.pr_number ?? '—') },
  { key: 'request_date', header: 'Date', render: (r) => String(r.request_date ?? '—') },
  { key: 'priority', header: 'Priority', render: (r) => String(r.priority ?? '—') },
  { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
  { key: 'remarks', header: 'Remarks', render: (r) => String(r.remarks ?? '—') },
];

const fields = [
  { name: 'pr_number', label: 'PR number', type: 'text', required: true },
  { name: 'request_date', label: 'Request date', type: 'date', required: true },
  { name: 'priority', label: 'Priority', type: 'select', required: true, options: [{ value: 'LOW', label: 'LOW' }, { value: 'NORMAL', label: 'NORMAL' }, { value: 'HIGH', label: 'HIGH' }, { value: 'URGENT', label: 'URGENT' }] },
  { name: 'remarks', label: 'Remarks', type: 'textarea' }
];

export default function Page() {
  return (
    <ModulePage
      title="Purchase Requisitions"
      subtitle="Indent requests from departments."
      table="opa_purchase_requisitions"
      moduleKey="purchase"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'request_date', ascending: false }}
      schema={prFormSchema}
      createDefaults={() => {
  const d = new Date().toISOString().slice(0, 10);
  return { request_date: d, pr_number: `PR-${d.replace(/-/g, '')}-NEW`, priority: 'NORMAL', status: 'DRAFT' };
}}
    />
  );
}
