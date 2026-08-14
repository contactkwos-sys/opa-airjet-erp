import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { employeeFormSchema } from "@/lib/validation";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'employee_code', header: 'Code', render: (r) => String(r.employee_code ?? '—') },
  { key: 'full_name', header: 'Name', render: (r) => String(r.full_name ?? '—') },
  { key: 'designation', header: 'Designation', render: (r) => String(r.designation ?? '—') },
  { key: 'department', header: 'Department', render: (r) => String(r.department ?? '—') },
  { key: 'mobile', header: 'Mobile', render: (r) => String(r.mobile ?? '—') },
];

const fields = [
  { name: 'employee_code', label: 'Employee code', type: 'text', required: true },
  { name: 'full_name', label: 'Full name', type: 'text', required: true },
  { name: 'designation', label: 'Designation', type: 'text' },
  { name: 'department', label: 'Department', type: 'text' },
  { name: 'mobile', label: 'Mobile', type: 'text' }
];

export default function Page() {
  return (
    <ModulePage
      title="Employees"
      subtitle="Workforce master for plant roles."
      table="opa_employees"
      moduleKey="hr"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'employee_code', ascending: true }}
      schema={employeeFormSchema}
      createDefaults={() => ({ is_active: true })}
    />
  );
}
