import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'entry_number', header: 'Entry #', render: (r) => String(r.entry_number ?? '—') },
    { key: 'direction', header: 'Direction', render: (r) => String(r.direction ?? '—') },
    { key: 'material_description', header: 'Material', render: (r) => String(r.material_description ?? '—') },
];

const fields = [
    { name: 'entry_number', label: 'Entry number', type: 'text', required: true },
    { name: 'direction', label: 'Direction', type: 'text', required: true },
    { name: 'material_description', label: 'Description', type: 'text', required: true },
];

const demoRows: Row[] = [
  { id: 'demo-1', entry_number: 'Sample', direction: 'Sample', material_description: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="Material Gate"
      subtitle="Inward and outward material logs."
      table="opa_material_gate_entries"
      moduleKey="security"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
