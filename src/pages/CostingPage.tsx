import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'costing_number', header: 'Costing #', render: (r) => String(r.costing_number ?? '—') },
    { key: 'entry_date', header: 'Date', render: (r) => String(r.entry_date ?? '—') },
    { key: 'total_cost', header: 'Total', render: (r) => String(r.total_cost ?? '—') },
];

const fields = [
    { name: 'costing_number', label: 'Costing number', type: 'text', required: true },
    { name: 'entry_date', label: 'Date', type: 'date', required: true },
    { name: 'yarn_cost', label: 'Yarn cost', type: 'number', required: false },
    { name: 'labour_cost', label: 'Labour cost', type: 'number', required: false },
];

const demoRows: Row[] = [
  { id: 'demo-1', costing_number: 'Sample', entry_date: new Date().toISOString().slice(0, 10), total_cost: 0 },
];

export default function Page() {
  return (
    <ModulePage
      title="Costing"
      subtitle="Cost per meter and cost sheets."
      table="opa_costing_entries"
      moduleKey="costing"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
