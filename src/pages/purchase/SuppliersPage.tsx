import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { supplierFormSchema } from "@/lib/validation";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  {
    key: "supplier_code",
    header: "Code",
    render: (r) => String(r.supplier_code ?? "—"),
  },
  { key: "name", header: "Name", render: (r) => String(r.name ?? "—") },
  {
    key: "contact_person",
    header: "Contact",
    render: (r) => String(r.contact_person ?? "—"),
  },
  { key: "mobile", header: "Mobile", render: (r) => String(r.mobile ?? "—") },
  { key: "city", header: "City", render: (r) => String(r.city ?? "—") },
  { key: "gstin", header: "GSTIN", render: (r) => String(r.gstin ?? "—") },
];

const fields = [
  { name: "supplier_code", label: "Supplier code", type: "text" as const, required: true },
  { name: "name", label: "Name", type: "text" as const, required: true },
  { name: "contact_person", label: "Contact person", type: "text" as const },
  { name: "mobile", label: "Mobile", type: "text" as const },
  { name: "email", label: "Email", type: "text" as const },
  { name: "city", label: "City", type: "text" as const },
  { name: "gstin", label: "GSTIN", type: "text" as const },
  { name: "payment_terms", label: "Payment terms", type: "text" as const },
];

export default function SuppliersPage() {
  return (
    <ModulePage
      title="Suppliers"
      subtitle="Vendor master for yarn, spares and services."
      table="opa_suppliers"
      moduleKey="purchase"
      columns={columns}
      fields={fields}
      orderBy={{ column: "supplier_code", ascending: true }}
      schema={supplierFormSchema}
      createDefaults={() => ({ is_active: true })}
    />
  );
}
