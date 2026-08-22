import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { stoppageFormSchema } from "@/lib/validation";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'loom_id', header: 'Loom', render: (r) => String(r.loom_id ?? '—') },
  { key: 'reason', header: 'Reason', render: (r) => String(r.reason ?? '—') },
  { key: 'start_time', header: 'Start', render: (r) => String(r.start_time ?? '—') },
  { key: 'end_time', header: 'End', render: (r) => String(r.end_time ?? '—') },
  { key: 'department', header: 'Dept', render: (r) => String(r.department ?? '—') },
  { key: 'remarks', header: 'Remarks', render: (r) => String(r.remarks ?? '—') },
];

const fields = [
  { name: 'loom_id', label: 'Loom ID', type: 'text', required: true, placeholder: 'Loom UUID' },
  { name: 'reason', label: 'Reason', type: 'select', required: true, options: [{ value: 'WARP_BREAK', label: 'WARP BREAK' }, { value: 'WEFT_BREAK', label: 'WEFT BREAK' }, { value: 'BEAM_CHANGE', label: 'BEAM CHANGE' }, { value: 'BREAKDOWN', label: 'BREAKDOWN' }, { value: 'POWER_FAILURE', label: 'POWER FAILURE' }, { value: 'PLANNED_MAINTENANCE', label: 'PLANNED MAINTENANCE' }, { value: 'OTHER', label: 'OTHER' }] },
  { name: 'start_time', label: 'Start time', type: 'datetime-local', required: true },
  { name: 'department', label: 'Department', type: 'text' },
  { name: 'remarks', label: 'Remarks', type: 'textarea' }
];

export default function Page() {
  return (
    <ModulePage
      title="Stoppages"
      subtitle="Loom downtime and stoppage reasons across sheds."
      table="opa_loom_stoppages"
      moduleKey="production"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'start_time', ascending: false }}
      schema={stoppageFormSchema}
      createDefaults={() => ({ start_time: new Date().toISOString().slice(0, 16), reason: 'OTHER' })}
    />
  );
}
