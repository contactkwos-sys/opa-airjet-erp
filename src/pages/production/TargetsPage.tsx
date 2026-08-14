import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { targetFormSchema } from "@/lib/validation";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'target_type', header: 'Type', render: (r) => String(r.target_type ?? '—') },
  { key: 'target_date', header: 'Date', render: (r) => String(r.target_date ?? '—') },
  { key: 'target_meter', header: 'Target (M)', render: (r) => String(r.target_meter ?? '—') },
  { key: 'actual_meter', header: 'Actual (M)', render: (r) => String(r.actual_meter ?? '—') },
  { key: 'remarks', header: 'Remarks', render: (r) => String(r.remarks ?? '—') },
];

const fields = [
  { name: 'target_type', label: 'Type', type: 'select', required: true, options: [{ value: 'DAILY', label: 'DAILY' }, { value: 'SHIFT', label: 'SHIFT' }, { value: 'LOOM', label: 'LOOM' }, { value: 'MONTHLY', label: 'MONTHLY' }] },
  { name: 'target_date', label: 'Date', type: 'date', required: true },
  { name: 'target_meter', label: 'Target meters', type: 'number', required: true },
  { name: 'remarks', label: 'Remarks', type: 'textarea' }
];

export default function Page() {
  return (
    <ModulePage
      title="Targets"
      subtitle="Daily, shift, loom and monthly production targets."
      table="opa_production_targets"
      moduleKey="production"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'target_date', ascending: false }}
      schema={targetFormSchema}
      createDefaults={() => ({ target_date: new Date().toISOString().slice(0, 10), target_type: 'DAILY', target_meter: 0 })}
    />
  );
}
