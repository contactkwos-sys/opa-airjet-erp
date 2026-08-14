import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { grnFormSchema } from "@/lib/validation";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'grn_number', header: 'GRN #', render: (r) => String(r.grn_number ?? '—') },
  { key: 'grn_date', header: 'Date', render: (r) => String(r.grn_date ?? '—') },
  { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
  { key: 'remarks', header: 'Remarks', render: (r) => String(r.remarks ?? '—') },
];

const fields = [
  { name: 'grn_number', label: 'GRN number', type: 'text', required: true },
  { name: 'grn_date', label: 'Date', type: 'date', required: true },
  { name: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'DRAFT', label: 'DRAFT' }, { value: 'COMPLETED', label: 'COMPLETED' }, { value: 'CANCELLED', label: 'CANCELLED' }] },
  { name: 'remarks', label: 'Remarks', type: 'textarea' }
];

export default function Page() {
  return (
    <ModulePage
      title="GRN"
      subtitle="Goods receipt notes against purchase orders."
      table="opa_grns"
      moduleKey="purchase"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'grn_date', ascending: false }}
      schema={grnFormSchema}
      createDefaults={() => {
  const d = new Date().toISOString().slice(0, 10);
  return { grn_date: d, grn_number: `GRN-${d.replace(/-/g, '')}-NEW`, status: 'DRAFT' };
}}
    />
  );
}
