import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'title', header: 'Title', render: (r) => String(r.title ?? '—') },
  { key: 'category', header: 'Category', render: (r) => String(r.category ?? '—') },
  { key: 'file_name', header: 'File', render: (r) => String(r.file_name ?? '—') },
  { key: 'created_at', header: 'Uploaded', render: (r) => String(r.created_at ?? '—') },
];

const fields = [
  { name: 'title', label: 'Title', type: 'text', required: true },
  { name: 'category', label: 'Category', type: 'select', required: true, options: [{ value: 'MAINTENANCE', label: 'MAINTENANCE' }, { value: 'QUALITY', label: 'QUALITY' }, { value: 'HR', label: 'HR' }, { value: 'SECURITY', label: 'SECURITY' }, { value: 'GENERAL', label: 'GENERAL' }] },
  { name: 'file_name', label: 'File name', type: 'text', required: true }
];

export default function Page() {
  return (
    <ModulePage
      title="Documents"
      subtitle="Plant manuals and attached documents registry."
      table="opa_documents"
      moduleKey="documents"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'created_at', ascending: false }}
      createDefaults={() => ({ category: 'GENERAL' })}
    />
  );
}
