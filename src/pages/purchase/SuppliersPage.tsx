import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { supplierFormSchema } from "@/lib/validation";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'supplier_code', header: 'Code', render: (r) => String(r.supplier_code ?? '—') },
  { key: 'name', header: 'Name', render: (r) => String(r.name ?? '—') },
  { key: 'contact_person', header: 'Contact', render: (r) => String(r.contact_person ?? '—') },
  { key: 'mobile', header: 'Mobile', render: (r) => String(r.mobile ?? '—') },
  { key: 'city', header: 'City', render: (r) => String(r.city ?? '—') },
];

const fields = [
  { name: 'supplier_code', label: 'Supplier code', type: 'text', required: true },
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'contact_person', label: 'Contact person', type: 'text' },
  { name: 'mobile', label: 'Mobile', type: 'text' },
  { name: 'city', label: 'City', type: 'text' }
];

export default function Page() {
  return (
    <ModulePage
      title="Suppliers"
      subtitle="Vendor master for yarn, spares and services."
      table="opa_suppliers"
      moduleKey="purchase"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'supplier_code', ascending: true }}
      schema={supplierFormSchema}
      createDefaults={() => ({ is_active: true })}
    />
  );
}
