import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'inspection_number', header: 'Inspection #', render: (r) => String(r.inspection_number ?? '—') },
    { key: 'inspection_date', header: 'Date', render: (r) => String(r.inspection_date ?? '—') },
    { key: 'result', header: 'Result', render: (r) => String(r.result ?? '—') },
];

const fields = [
    { name: 'inspection_number', label: 'Inspection number', type: 'text', required: true },
    { name: 'inspection_date', label: 'Date', type: 'date', required: true },
    { name: 'result', label: 'Result', type: 'text', required: true },
];

const demoRows: Row[] = [
  { id: 'demo-1', inspection_number: 'Sample', inspection_date: new Date().toISOString().slice(0, 10), result: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="Quality"
      subtitle="Inspections, grades, and defect capture."
      table="opa_quality_inspections"
      moduleKey="quality"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
