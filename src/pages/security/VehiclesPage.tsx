import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'entry_number', header: 'Entry #', render: (r) => String(r.entry_number ?? '—') },
    { key: 'vehicle_number', header: 'Vehicle', render: (r) => String(r.vehicle_number ?? '—') },
    { key: 'direction', header: 'Direction', render: (r) => String(r.direction ?? '—') },
];

const fields = [
    { name: 'entry_number', label: 'Entry number', type: 'text', required: true },
    { name: 'vehicle_number', label: 'Vehicle number', type: 'text', required: true },
    { name: 'direction', label: 'Direction', type: 'text', required: true },
    { name: 'driver_name', label: 'Driver', type: 'text', required: false },
];

const demoRows: Row[] = [
  { id: 'demo-1', entry_number: 'Sample', vehicle_number: 'Sample', direction: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="Vehicles"
      subtitle="Vehicle gate entries."
      table="opa_vehicle_entries"
      moduleKey="security"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
