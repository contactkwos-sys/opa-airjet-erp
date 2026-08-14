import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'beam_number', header: 'Beam #', render: (r) => String(r.beam_number ?? '—') },
    { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
    { key: 'length_meters', header: 'Length', render: (r) => String(r.length_meters ?? '—') },
];

const fields = [
    { name: 'beam_number', label: 'Beam number', type: 'text', required: true },
    { name: 'status', label: 'Status', type: 'text', required: true },
    { name: 'length_meters', label: 'Length m', type: 'number', required: false },
];

const demoRows: Row[] = [
  { id: 'demo-1', beam_number: 'Sample', status: 'Sample', length_meters: 0 },
];

export default function Page() {
  return (
    <ModulePage
      title="Beams"
      subtitle="Warp beam lifecycle and loom assignment."
      table="opa_beams"
      moduleKey="inventory"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
