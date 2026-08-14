import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { StatusBadge } from "@/components/ui";
import { rfqFormSchema } from "@/lib/validation";

type Row = Record<string, unknown> & { id: string };

const DOC_STATUS = [
  { value: "DRAFT", label: "DRAFT" },
  { value: "SUBMITTED", label: "SUBMITTED" },
  { value: "APPROVED", label: "APPROVED" },
  { value: "REJECTED", label: "REJECTED" },
  { value: "PARTIAL", label: "PARTIAL" },
  { value: "COMPLETED", label: "COMPLETED" },
  { value: "CANCELLED", label: "CANCELLED" },
  { value: "CLOSED", label: "CLOSED" },
];

const columns: Column<Row>[] = [
  { key: "rfq_number", header: "RFQ #", render: (r) => String(r.rfq_number ?? "—") },
  { key: "rfq_date", header: "RFQ date", render: (r) => String(r.rfq_date ?? "—") },
  { key: "due_date", header: "Due", render: (r) => String(r.due_date ?? "—") },
  {
    key: "status",
    header: "Status",
    render: (r) => <StatusBadge status={String(r.status ?? "DRAFT")} />,
  },
  { key: "remarks", header: "Remarks", render: (r) => String(r.remarks ?? "—") },
];

const fields = [
  { name: "rfq_number", label: "RFQ number", type: "text" as const, required: true },
  { name: "rfq_date", label: "RFQ date", type: "date" as const, required: true },
  { name: "due_date", label: "Due date", type: "date" as const },
  {
    name: "status",
    label: "Status",
    type: "select" as const,
    required: true,
    options: DOC_STATUS,
  },
  { name: "remarks", label: "Remarks", type: "textarea" as const },
];

export default function RfqPage() {
  return (
    <ModulePage
      title="Purchase RFQ"
      subtitle="Request for quotations against requisitions."
      table="opa_rfqs"
      moduleKey="purchase"
      columns={columns}
      fields={fields}
      orderBy={{ column: "rfq_date", ascending: false }}
      schema={rfqFormSchema}
      createDefaults={() => {
        const d = new Date().toISOString().slice(0, 10);
        return {
          rfq_date: d,
          rfq_number: `RFQ-${d.replace(/-/g, "")}-NEW`,
          status: "DRAFT",
        };
      }}
    />
  );
}
