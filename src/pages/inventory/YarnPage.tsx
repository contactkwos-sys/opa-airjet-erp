import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { yarnFormSchema } from "@/lib/validation";
type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: 'yarn_code', header: 'Code', render: (r) => String(r.yarn_code ?? '—') },
  { key: 'name', header: 'Name', render: (r) => String(r.name ?? '—') },
  { key: 'count', header: 'Count', render: (r) => String(r.count ?? '—') },
  { key: 'blend', header: 'Blend', render: (r) => String(r.blend ?? '—') },
  { key: 'uom', header: 'UOM', render: (r) => String(r.uom ?? '—') },
];

const fields = [
  { name: 'yarn_code', label: 'Yarn code', type: 'text', required: true },
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'count', label: 'Count', type: 'text' },
  { name: 'blend', label: 'Blend', type: 'text' },
  { name: 'uom', label: 'UOM', type: 'text', required: true }
];

export default function Page() {
  return (
    <ModulePage
      title="Yarn"
      subtitle="Yarn master and counts for warp/weft planning."
      table="opa_yarn_master"
      moduleKey="yarn"
      columns={columns}
      fields={fields}
      orderBy={{ column: 'yarn_code', ascending: true }}
      schema={yarnFormSchema}
      createDefaults={() => ({ uom: 'KG', is_active: true })}
    />
  );
}
