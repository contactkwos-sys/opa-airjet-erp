import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { qualityFormSchema } from "@/lib/validation";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'inspection_number', header: 'Inspection #', render: (r) => String(r.inspection_number ?? '—') },
  { key: 'inspection_date', header: 'Date', render: (r) => String(r.inspection_date ?? '—') },
  { key: 'result', header: 'Result', render: (r) => String(r.result ?? '—') },
  { key: 'grade', header: 'Grade', render: (r) => String(r.grade ?? '—') },
  { key: 'sample_meters', header: 'Sample (M)', render: (r) => String(r.sample_meters ?? '—') },
  { key: 'remarks', header: 'Remarks', render: (r) => String(r.remarks ?? '—') },
];

const fields = [
  { name: 'inspection_number', label: 'Inspection number', type: 'text', required: true },
  { name: 'inspection_date', label: 'Date', type: 'date', required: true },
  { name: 'result', label: 'Result', type: 'select', required: true, options: [{ value: 'PASS', label: 'PASS' }, { value: 'FAIL', label: 'FAIL' }, { value: 'HOLD', label: 'HOLD' }, { value: 'REWORK', label: 'REWORK' }] },
  { name: 'grade', label: 'Grade', type: 'text' },
  { name: 'sample_meters', label: 'Sample meters', type: 'number' },
  { name: 'remarks', label: 'Remarks', type: 'textarea' }
];

export default function Page() {
  return (
    <ModulePage
      title="Quality"
      subtitle="Inspections, grades and hold decisions."
      table="opa_quality_inspections"
      moduleKey="quality"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'inspection_date', ascending: false }}
      schema={qualityFormSchema}
      createDefaults={() => {
  const d = new Date().toISOString().slice(0, 10);
  return { inspection_date: d, inspection_number: `QC-${d.replace(/-/g, '')}-NEW`, result: 'PASS' };
}}
    />
  );
}
