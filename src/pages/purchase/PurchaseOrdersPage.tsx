import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { StatusBadge } from "@/components/ui";
import { poFormSchema } from "@/lib/validation";

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

const PAY_STATUS = [
  { value: "PENDING", label: "PENDING" },
  { value: "PARTIAL", label: "PARTIAL" },
  { value: "PAID", label: "PAID" },
  { value: "OVERDUE", label: "OVERDUE" },
  { value: "CANCELLED", label: "CANCELLED" },
];

const columns: Column<Row>[] = [
  { key: "po_number", header: "PO #", render: (r) => String(r.po_number ?? "—") },
  { key: "po_date", header: "Date", render: (r) => String(r.po_date ?? "—") },
  {
    key: "total_amount",
    header: "Amount",
    render: (r) => Number(r.total_amount ?? 0).toLocaleString("en-IN"),
  },
  {
    key: "status",
    header: "Status",
    render: (r) => <StatusBadge status={String(r.status ?? "DRAFT")} />,
  },
  {
    key: "payment_status",
    header: "Payment",
    render: (r) => String(r.payment_status ?? "—"),
  },
  { key: "remarks", header: "Remarks", render: (r) => String(r.remarks ?? "—") },
];

const fields = [
  { name: "po_number", label: "PO number", type: "text" as const, required: true },
  { name: "po_date", label: "PO date", type: "date" as const, required: true },
  { name: "total_amount", label: "Total amount", type: "number" as const, required: true },
  { name: "currency", label: "Currency", type: "text" as const },
  {
    name: "status",
    label: "Status",
    type: "select" as const,
    required: true,
    options: DOC_STATUS,
  },
  {
    name: "payment_status",
    label: "Payment status",
    type: "select" as const,
    options: PAY_STATUS,
  },
  { name: "remarks", label: "Remarks", type: "textarea" as const },
];

export default function PurchaseOrdersPage() {
  return (
    <ModulePage
      title="Purchase Orders"
      subtitle="Approved purchase orders and values."
      table="opa_purchase_orders"
      moduleKey="purchase"
      columns={columns}
      fields={fields}
      orderBy={{ column: "po_date", ascending: false }}
      schema={poFormSchema}
      createDefaults={() => {
        const d = new Date().toISOString().slice(0, 10);
        return {
          po_date: d,
          po_number: `PO-${d.replace(/-/g, "")}-NEW`,
          status: "DRAFT",
          payment_status: "PENDING",
          currency: "INR",
          total_amount: 0,
        };
      }}
    />
  );
}
