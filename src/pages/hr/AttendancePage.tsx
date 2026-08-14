import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { attendanceFormSchema } from "@/lib/validation";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'attendance_date', header: 'Date', render: (r) => String(r.attendance_date ?? '—') },
  { key: 'employee_name', header: 'Employee', render: (r) => String(r.employee_name ?? '—') },
  { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
  { key: 'check_in', header: 'In', render: (r) => String(r.check_in ?? '—') },
  { key: 'check_out', header: 'Out', render: (r) => String(r.check_out ?? '—') },
];

const fields = [
  { name: 'attendance_date', label: 'Date', type: 'date', required: true },
  { name: 'employee_name', label: 'Employee name', type: 'text', required: true },
  { name: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'PRESENT', label: 'PRESENT' }, { value: 'ABSENT', label: 'ABSENT' }, { value: 'HALF_DAY', label: 'HALF DAY' }, { value: 'LEAVE', label: 'LEAVE' }, { value: 'HOLIDAY', label: 'HOLIDAY' }, { value: 'WEEK_OFF', label: 'WEEK OFF' }] }
];

export default function Page() {
  return (
    <ModulePage
      title="Attendance"
      subtitle="Daily attendance and leave tracking."
      table="opa_attendance"
      moduleKey="hr"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'attendance_date', ascending: false }}
      schema={attendanceFormSchema}
      createDefaults={() => ({ attendance_date: new Date().toISOString().slice(0, 10), status: 'PRESENT' })}
    />
  );
}
