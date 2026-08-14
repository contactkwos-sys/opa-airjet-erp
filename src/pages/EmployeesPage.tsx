import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'employee_code', header: 'Code', render: (r) => String(r.employee_code ?? '—') },
    { key: 'full_name', header: 'Name', render: (r) => String(r.full_name ?? '—') },
    { key: 'designation', header: 'Designation', render: (r) => String(r.designation ?? '—') },
];

const fields = [
    { name: 'employee_code', label: 'Employee code', type: 'text', required: true },
    { name: 'full_name', label: 'Full name', type: 'text', required: true },
    { name: 'designation', label: 'Designation', type: 'text', required: false },
    { name: 'mobile', label: 'Mobile', type: 'text', required: false },
];

const demoRows: Row[] = [
  { id: 'demo-1', employee_code: 'Sample', full_name: 'Sample', designation: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="Employees"
      subtitle="Workforce master."
      table="opa_employees"
      moduleKey="hr"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
