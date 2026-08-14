import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { visitorFormSchema } from "@/lib/validation";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'visitor_code', header: 'Code', render: (r) => String(r.visitor_code ?? '—') },
  { key: 'full_name', header: 'Name', render: (r) => String(r.full_name ?? '—') },
  { key: 'mobile', header: 'Mobile', render: (r) => String(r.mobile ?? '—') },
  { key: 'company', header: 'Company', render: (r) => String(r.company ?? '—') },
];

const fields = [
  { name: 'visitor_code', label: 'Visitor code', type: 'text', required: true },
  { name: 'full_name', label: 'Full name', type: 'text', required: true },
  { name: 'mobile', label: 'Mobile', type: 'text' },
  { name: 'company', label: 'Company', type: 'text' }
];

export default function Page() {
  return (
    <ModulePage
      title="Visitors"
      subtitle="Visitor master for gate and CEO meetings."
      table="opa_visitors"
      moduleKey="security"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'full_name', ascending: true }}
      schema={visitorFormSchema}
      createDefaults={() => ({ is_blacklisted: false })}
    />
  );
}
