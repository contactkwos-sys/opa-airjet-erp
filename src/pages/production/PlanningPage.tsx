import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { planFormSchema } from "@/lib/validation";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'plan_number', header: 'Plan #', render: (r) => String(r.plan_number ?? '—') },
  { key: 'plan_date', header: 'Date', render: (r) => String(r.plan_date ?? '—') },
  { key: 'planned_meter', header: 'Planned (M)', render: (r) => String(r.planned_meter ?? '—') },
  { key: 'actual_meter', header: 'Actual (M)', render: (r) => String(r.actual_meter ?? '—') },
  { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
  { key: 'remarks', header: 'Remarks', render: (r) => String(r.remarks ?? '—') },
];

const fields = [
  { name: 'plan_number', label: 'Plan number', type: 'text', required: true },
  { name: 'plan_date', label: 'Date', type: 'date', required: true },
  { name: 'planned_meter', label: 'Planned meters', type: 'number', required: true },
  { name: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'DRAFT', label: 'DRAFT' }, { value: 'APPROVED', label: 'APPROVED' }, { value: 'IN_PROGRESS', label: 'IN PROGRESS' }, { value: 'COMPLETED', label: 'COMPLETED' }, { value: 'CANCELLED', label: 'CANCELLED' }] },
  { name: 'remarks', label: 'Remarks', type: 'textarea' }
];

export default function Page() {
  return (
    <ModulePage
      title="Planning"
      subtitle="Shift and loom production plans."
      table="opa_production_plans"
      moduleKey="production"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'plan_date', ascending: false }}
      schema={planFormSchema}
      createDefaults={() => {
  const d = new Date().toISOString().slice(0, 10);
  return { plan_date: d, plan_number: `PLN-${d.replace(/-/g, '')}-NEW`, status: 'DRAFT', planned_meter: 0 };
}}
    />
  );
}
