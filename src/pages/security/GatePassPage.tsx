import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { gatePassFormSchema } from "@/lib/validation";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'pass_number', header: 'Pass #', render: (r) => String(r.pass_number ?? '—') },
  { key: 'pass_type', header: 'Type', render: (r) => String(r.pass_type ?? '—') },
  { key: 'purpose', header: 'Purpose', render: (r) => String(r.purpose ?? '—') },
  { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
  { key: 'valid_from', header: 'Valid from', render: (r) => String(r.valid_from ?? '—') },
];

const fields = [
  { name: 'pass_number', label: 'Pass number', type: 'text', required: true },
  { name: 'pass_type', label: 'Type', type: 'select', required: true, options: [{ value: 'VISITOR', label: 'VISITOR' }, { value: 'EMPLOYEE', label: 'EMPLOYEE' }, { value: 'MATERIAL', label: 'MATERIAL' }, { value: 'VEHICLE', label: 'VEHICLE' }, { value: 'OTHER', label: 'OTHER' }] },
  { name: 'purpose', label: 'Purpose', type: 'text', required: true },
  { name: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'ACTIVE', label: 'ACTIVE' }, { value: 'EXPIRED', label: 'EXPIRED' }, { value: 'CANCELLED', label: 'CANCELLED' }] }
];

export default function Page() {
  return (
    <ModulePage
      title="Gate Pass"
      subtitle="Visitor, employee and material gate passes."
      table="opa_gate_passes"
      moduleKey="security"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'created_at', ascending: false }}
      schema={gatePassFormSchema}
      createDefaults={() => {
  const d = new Date().toISOString().slice(0, 10);
  return { pass_number: `GP-${d.replace(/-/g, '')}-NEW`, pass_type: 'VISITOR', status: 'ACTIVE', valid_from: new Date().toISOString() };
}}
    />
  );
}
