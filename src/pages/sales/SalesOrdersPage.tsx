import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { StatusBadge } from "@/components/ui";
import { salesOrderFormSchema } from "@/lib/validation";

type Row = Record<string, unknown> & { id: string };

const DOC_STATUS = [
  { value: "DRAFT", label: "DRAFT" },
  { value: "SUBMITTED", label: "SUBMITTED" },
  { value: "APPROVED", label: "APPROVED" },
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
  { key: "so_number", header: "SO #", render: (r) => String(r.so_number ?? "—") },
  { key: "so_date", header: "Date", render: (r) => String(r.so_date ?? "—") },
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
  { name: "so_number", label: "SO number", type: "text" as const, required: true },
  { name: "so_date", label: "Date", type: "date" as const, required: true },
  { name: "total_amount", label: "Total amount", type: "number" as const, required: true },
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

export default function SalesOrdersPage() {
  return (
    <ModulePage
      title="Sales Orders"
      subtitle="Customer orders and fulfilment status."
      table="opa_sales_orders"
      moduleKey="sales"
      columns={columns}
      fields={fields}
      orderBy={{ column: "so_date", ascending: false }}
      schema={salesOrderFormSchema}
      createDefaults={() => {
        const d = new Date().toISOString().slice(0, 10);
        return {
          so_date: d,
          so_number: `SO-${d.replace(/-/g, "")}-NEW`,
          status: "DRAFT",
          payment_status: "PENDING",
          total_amount: 0,
        };
      }}
    />
  );
}
