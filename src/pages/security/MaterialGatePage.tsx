import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { materialGateFormSchema } from "@/lib/validation";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'entry_number', header: 'Entry #', render: (r) => String(r.entry_number ?? '—') },
  { key: 'direction', header: 'Direction', render: (r) => String(r.direction ?? '—') },
  { key: 'material_description', header: 'Material', render: (r) => String(r.material_description ?? '—') },
  { key: 'vehicle_number', header: 'Vehicle', render: (r) => String(r.vehicle_number ?? '—') },
  { key: 'entry_at', header: 'When', render: (r) => String(r.entry_at ?? '—') },
];

const fields = [
  { name: 'entry_number', label: 'Entry number', type: 'text', required: true },
  { name: 'direction', label: 'Direction', type: 'select', required: true, options: [{ value: 'INWARD', label: 'INWARD' }, { value: 'OUTWARD', label: 'OUTWARD' }] },
  { name: 'material_description', label: 'Material description', type: 'textarea', required: true },
  { name: 'vehicle_number', label: 'Vehicle number', type: 'text' }
];

export default function Page() {
  return (
    <ModulePage
      title="Material Gate"
      subtitle="Material inward and outward gate entries."
      table="opa_material_gate_entries"
      moduleKey="security"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'entry_at', ascending: false }}
      schema={materialGateFormSchema}
      createDefaults={() => {
  const d = new Date().toISOString().slice(0, 10);
  return { entry_number: `MG-${d.replace(/-/g, '')}-NEW`, direction: 'INWARD', entry_at: new Date().toISOString() };
}}
    />
  );
}
