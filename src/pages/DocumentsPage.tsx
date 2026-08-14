import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
    { key: 'file_name', header: 'File', render: (r) => String(r.file_name ?? '—') },
    { key: 'module', header: 'Module', render: (r) => String(r.module ?? '—') },
];

const fields = [
    { name: 'file_name', label: 'File name', type: 'text', required: true },
    { name: 'module', label: 'Module', type: 'text', required: true },
    { name: 'storage_path', label: 'Storage path', type: 'text', required: true },
    { name: 'record_id', label: 'Record ID', type: 'text', required: true },
];

const demoRows: Row[] = [
  { id: 'demo-1', file_name: 'Sample', module: 'Sample' },
];

export default function Page() {
  return (
    <ModulePage
      title="Documents"
      subtitle="Attached documents and files."
      table="opa_documents"
      moduleKey="documents"
      columns={columns}
      fields={fields}
      demoRows={demoRows}
    />
  );
}
