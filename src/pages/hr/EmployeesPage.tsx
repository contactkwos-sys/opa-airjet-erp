import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { employeeFormSchema } from "@/lib/validation";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  {
    key: "employee_code",
    header: "Code",
    render: (r) => String(r.employee_code ?? "—"),
  },
  { key: "full_name", header: "Name", render: (r) => String(r.full_name ?? "—") },
  {
    key: "designation",
    header: "Designation",
    render: (r) => String(r.designation ?? "—"),
  },
  {
    key: "department",
    header: "Department",
    render: (r) => String(r.department ?? "—"),
  },
  { key: "mobile", header: "Mobile", render: (r) => String(r.mobile ?? "—") },
  {
    key: "date_of_joining",
    header: "Joined",
    render: (r) => String(r.date_of_joining ?? "—"),
  },
];

const fields = [
  {
    name: "employee_code",
    label: "Employee code",
    type: "text" as const,
    required: true,
  },
  { name: "full_name", label: "Full name", type: "text" as const, required: true },
  { name: "designation", label: "Designation", type: "text" as const },
  { name: "department", label: "Department", type: "text" as const },
  { name: "mobile", label: "Mobile", type: "text" as const },
  { name: "email", label: "Email", type: "text" as const },
  { name: "date_of_joining", label: "Date of joining", type: "date" as const },
];

export default function EmployeesPage() {
  return (
    <ModulePage
      title="Employees"
      subtitle="Workforce master for plant roles."
      table="opa_employees"
      moduleKey="hr"
      columns={columns}
      fields={fields}
      orderBy={{ column: "employee_code", ascending: true }}
      schema={employeeFormSchema}
      createDefaults={() => ({ is_active: true })}
    />
  );
}
