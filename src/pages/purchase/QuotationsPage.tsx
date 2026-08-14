import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { StatusBadge } from "@/components/ui";
import { quotationFormSchema } from "@/lib/validation";

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
  {
    key: "quotation_number",
    header: "Quote #",
    render: (r) => String(r.quotation_number ?? "—"),
  },
  {
    key: "supplier_name",
    header: "Supplier",
    render: (r) => String(r.supplier_name ?? r.supplier_id ?? "—"),
  },
  {
    key: "rate",
    header: "Rate",
    render: (r) =>
      r.rate != null
        ? Number(r.rate).toLocaleString("en-IN", { maximumFractionDigits: 4 })
        : "—",
  },
  {
    key: "total_amount",
    header: "Amount",
    render: (r) =>
      r.total_amount != null
        ? Number(r.total_amount).toLocaleString("en-IN")
        : "—",
  },
  {
    key: "status",
    header: "Status",
    render: (r) => <StatusBadge status={String(r.status ?? "DRAFT")} />,
  },
  {
    key: "is_selected",
    header: "Selected",
    render: (r) => (r.is_selected ? "Yes" : "—"),
  },
  {
    key: "valid_until",
    header: "Valid until",
    render: (r) => String(r.valid_until ?? "—"),
  },
];

const fields = [
  {
    name: "quotation_number",
    label: "Quotation number",
    type: "text" as const,
    required: true,
  },
  {
    name: "supplier_name",
    label: "Supplier",
    type: "text" as const,
    required: true,
    placeholder: "Indo Yarn Traders",
  },
  {
    name: "quotation_date",
    label: "Quote date",
    type: "date" as const,
    required: true,
  },
  { name: "valid_until", label: "Valid until", type: "date" as const },
  { name: "rate", label: "Unit rate", type: "number" as const, required: true },
  {
    name: "total_amount",
    label: "Total amount",
    type: "number" as const,
    required: true,
  },
  {
    name: "currency",
    label: "Currency",
    type: "text" as const,
    required: true,
  },
  {
    name: "status",
    label: "Status",
    type: "select" as const,
    required: true,
    options: DOC_STATUS,
  },
  { name: "remarks", label: "Remarks", type: "textarea" as const },
];

export default function QuotationsPage() {
  return (
    <ModulePage
      title="Supplier Quotations"
      subtitle="Compare supplier rates and select preferred quotes."
      table="opa_supplier_quotations"
      moduleKey="purchase"
      columns={columns}
      fields={fields}
      orderBy={{ column: "quotation_date", ascending: false }}
      schema={quotationFormSchema}
      createDefaults={() => {
        const d = new Date().toISOString().slice(0, 10);
        return {
          quotation_date: d,
          quotation_number: `SQ-${d.replace(/-/g, "")}-NEW`,
          currency: "INR",
          status: "DRAFT",
          rate: 0,
          total_amount: 0,
          is_selected: false,
        };
      }}
    />
  );
}
