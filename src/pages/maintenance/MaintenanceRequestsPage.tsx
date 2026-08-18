import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { StatusBadge } from "@/components/ui";
import { maintRequestFormSchema } from "@/lib/validation";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  {
    key: "request_number",
    header: "Request #",
    render: (r) => String(r.request_number ?? "—"),
  },
  { key: "loom_id", header: "Loom", render: (r) => String(r.loom_id ?? "—") },
  { key: "issue_type", header: "Type", render: (r) => String(r.issue_type ?? "—") },
  {
    key: "description",
    header: "Description",
    render: (r) => String(r.description ?? "—"),
  },
  { key: "priority", header: "Priority", render: (r) => String(r.priority ?? "—") },
  {
    key: "status",
    header: "Status",
    render: (r) => <StatusBadge status={String(r.status ?? "OPEN")} />,
  },
];

const fields = [
  {
    name: "request_number",
    label: "Request number",
    type: "text" as const,
    required: true,
  },
  {
    name: "loom_id",
    label: "Loom ID",
    type: "text" as const,
    placeholder: "demo-loom-23",
  },
  {
    name: "issue_type",
    label: "Issue type",
    type: "select" as const,
    required: true,
    options: [
      { value: "MECHANICAL", label: "MECHANICAL" },
      { value: "ELECTRONICAL", label: "ELECTRONICAL" },
      { value: "ELECTRICAL", label: "ELECTRICAL" },
      { value: "AIR", label: "AIR" },
      { value: "OTHER", label: "OTHER" },
    ],
  },
  {
    name: "description",
    label: "Description",
    type: "textarea" as const,
    required: true,
  },
  {
    name: "priority",
    label: "Priority",
    type: "select" as const,
    required: true,
    options: [
      { value: "LOW", label: "LOW" },
      { value: "MEDIUM", label: "MEDIUM" },
      { value: "HIGH", label: "HIGH" },
      { value: "CRITICAL", label: "CRITICAL" },
    ],
  },
  {
    name: "status",
    label: "Status",
    type: "select" as const,
    required: true,
    options: [
      { value: "OPEN", label: "OPEN" },
      { value: "ASSIGNED", label: "ASSIGNED" },
      { value: "IN_PROGRESS", label: "IN PROGRESS" },
      { value: "ON_HOLD", label: "ON HOLD" },
      { value: "COMPLETED", label: "COMPLETED" },
      { value: "CANCELLED", label: "CANCELLED" },
      { value: "CLOSED", label: "CLOSED" },
    ],
  },
  { name: "remarks", label: "Remarks", type: "textarea" as const },
];

export default function MaintenanceRequestsPage() {
  return (
    <ModulePage
      title="Maintenance Requests"
      subtitle="Breakdown and repair requests from the shed."
      table="opa_maintenance_requests"
      moduleKey="maintenance"
      columns={columns}
      fields={fields}
      orderBy={{ column: "request_date", ascending: false }}
      schema={maintRequestFormSchema}
      createDefaults={() => {
        const d = new Date().toISOString().slice(0, 10);
        return {
          request_number: `MR-${d.replace(/-/g, "")}-NEW`,
          priority: "MEDIUM",
          status: "OPEN",
          request_date: new Date().toISOString(),
        };
      }}
    />
  );
}
