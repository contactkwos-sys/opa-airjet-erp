import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'dispatch_number', header: 'Dispatch #', render: (r) => String(r.dispatch_number ?? '—') },
    { key: 'dispatch_date', header: 'Date', render: (r) => String(r.dispatch_date ?? '—') },
    { key: 'status', header: 'Status', render: (r) => String(r.status ?? '—') },
];

const fields = [
    { name: 'dispatch_number', label: 'Dispatch number', type: 'text', required: true },
    { name: 'dispatch_date', label: 'Date', type: 'date', required: true },
    { name: 'vehicle_number', label: 'Vehicle', type: 'text', required: false },
];

const demoRows: Row[] = [
  { id: 'demo-1', dispatch_number: 'Sample', dispatch_date: new Date().toISOString().slice(0, 10), status: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="Dispatch"
      subtitle="Outbound dispatches and LR tracking."
      table="opa_dispatches"
      moduleKey="sales"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
