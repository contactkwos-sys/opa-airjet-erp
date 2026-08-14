import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { customerFormSchema } from "@/lib/validation";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'customer_code', header: 'Code', render: (r) => String(r.customer_code ?? '—') },
  { key: 'name', header: 'Name', render: (r) => String(r.name ?? '—') },
  { key: 'contact_person', header: 'Contact', render: (r) => String(r.contact_person ?? '—') },
  { key: 'mobile', header: 'Mobile', render: (r) => String(r.mobile ?? '—') },
  { key: 'city', header: 'City', render: (r) => String(r.city ?? '—') },
];

const fields = [
  { name: 'customer_code', label: 'Customer code', type: 'text', required: true },
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'contact_person', label: 'Contact person', type: 'text' },
  { name: 'mobile', label: 'Mobile', type: 'text' },
  { name: 'city', label: 'City', type: 'text' }
];

export default function Page() {
  return (
    <ModulePage
      title="Customers"
      subtitle="Buyer master and contact details."
      table="opa_customers"
      moduleKey="sales"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'customer_code', ascending: true }}
      schema={customerFormSchema}
      createDefaults={() => ({ is_active: true })}
    />
  );
}
