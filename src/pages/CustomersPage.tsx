import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'customer_code', header: 'Code', render: (r) => String(r.customer_code ?? '—') },
    { key: 'name', header: 'Name', render: (r) => String(r.name ?? '—') },
    { key: 'mobile', header: 'Mobile', render: (r) => String(r.mobile ?? '—') },
];

const fields = [
    { name: 'customer_code', label: 'Code', type: 'text', required: true },
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'mobile', label: 'Mobile', type: 'text', required: false },
    { name: 'email', label: 'Email', type: 'email', required: false },
];

const demoRows: Row[] = [
  { id: 'demo-1', customer_code: 'Sample', name: 'Sample', mobile: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="Customers"
      subtitle="Customer master."
      table="opa_customers"
      moduleKey="sales"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
