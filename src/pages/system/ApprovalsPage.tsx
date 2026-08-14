import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { StatusBadge } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  {
    key: "entity_type",
    header: "Entity",
    render: (r) => String(r.entity_type ?? "—"),
  },
  {
    key: "status",
    header: "Status",
    render: (r) => <StatusBadge status={String(r.status ?? "PENDING")} />,
  },
  { key: "remarks", header: "Remarks", render: (r) => String(r.remarks ?? "—") },
  {
    key: "requested_at",
    header: "Requested",
    render: (r) => String(r.requested_at ?? "—"),
  },
];

const fields = [
  {
    name: "entity_type",
    label: "Entity type",
    type: "text" as const,
    required: true,
  },
  {
    name: "status",
    label: "Status",
    type: "select" as const,
    required: true,
    options: [
      { value: "PENDING", label: "PENDING" },
      { value: "APPROVED", label: "APPROVED" },
      { value: "REJECTED", label: "REJECTED" },
      { value: "CANCELLED", label: "CANCELLED" },
    ],
  },
  { name: "remarks", label: "Remarks", type: "textarea" as const },
];

export default function ApprovalsPage() {
  return (
    <ModulePage
      title="Approvals"
      subtitle="Pending approvals across purchase and finance."
      table="opa_approvals"
      moduleKey="approvals"
      columns={columns}
      fields={fields}
      orderBy={{ column: "requested_at", ascending: false }}
      createDefaults={() => ({
        status: "PENDING",
        requested_at: new Date().toISOString(),
        entity_type: "purchase_order",
      })}
    />
  );
}
