import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'employee_id', header: 'Employee', render: (r) => String(r.employee_id ?? '—') },
    { key: 'attendance_date', header: 'Date', render: (r) => String(r.attendance_date ?? '—') },
    { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
];

const fields = [
    { name: 'employee_id', label: 'Employee ID', type: 'text', required: true },
    { name: 'attendance_date', label: 'Date', type: 'date', required: true },
    { name: 'status', label: 'Status', type: 'text', required: true },
];

const demoRows: Row[] = [
  { id: 'demo-1', employee_id: 'Sample', attendance_date: new Date().toISOString().slice(0, 10), status: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="Attendance"
      subtitle="Daily attendance register."
      table="opa_attendance"
      moduleKey="hr"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
