import { useCallback, useEffect, useMemo, useState } from "react";
import { listRows, type Row } from "@/lib/api";
import {
  PageHeader,
  DataTable,
  StatCard,
  LoadingState,
  ErrorState,
  StatusBadge,
  type Column,
} from "@/components/ui";

function bucket(days: number): string {
  if (days <= 0) return "Current";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

function withAgeing(rows: Row[]): Row[] {
  return rows.map((r) => {
    const due = r.due_date ? new Date(String(r.due_date)) : null;
    const days =
      typeof r.days_overdue === "number"
        ? Number(r.days_overdue)
        : due
          ? Math.max(
              0,
              Math.floor((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24)),
            )
          : 0;
    return {
      ...r,
      days_overdue: days,
      ageing_bucket: r.ageing_bucket ?? bucket(days),
    };
  });
}

export default function AccountsPage() {
  const [ar, setAr] = useState<Row[]>([]);
  const [ap, setAp] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [receipts, payments] = await Promise.all([
      listRows("opa_receipts", { orderBy: { column: "receipt_date", ascending: false } }),
      listRows("opa_payments", { orderBy: { column: "payment_date", ascending: false } }),
    ]);
    setAr(withAgeing(receipts.data));
    setAp(withAgeing(payments.data));
    if (receipts.error) setError(receipts.error);
    else if (payments.error) setError(payments.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const sum = (rows: Row[], pred: (r: Row) => boolean) =>
      rows.filter(pred).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    return {
      arOpen: sum(ar, (r) => r.status !== "PAID"),
      apOpen: sum(ap, (r) => r.status !== "PAID"),
      arOver60: sum(ar, (r) => Number(r.days_overdue) > 60),
      apOver60: sum(ap, (r) => Number(r.days_overdue) > 60),
    };
  }, [ar, ap]);

  const arColumns: Column<Row>[] = [
    { key: "receipt_number", header: "Receipt #", render: (r) => String(r.receipt_number ?? "—") },
    { key: "customer_name", header: "Customer", render: (r) => String(r.customer_name ?? "—") },
    { key: "amount", header: "Amount", render: (r) => Number(r.amount ?? 0).toLocaleString("en-IN") },
    { key: "due_date", header: "Due", render: (r) => String(r.due_date ?? "—") },
    { key: "days_overdue", header: "Days", render: (r) => String(r.days_overdue ?? 0) },
    { key: "ageing_bucket", header: "Bucket", render: (r) => String(r.ageing_bucket ?? "—") },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={String(r.status ?? "PENDING")} />,
    },
  ];

  const apColumns: Column<Row>[] = [
    { key: "payment_number", header: "Payment #", render: (r) => String(r.payment_number ?? "—") },
    { key: "supplier_name", header: "Supplier", render: (r) => String(r.supplier_name ?? "—") },
    { key: "amount", header: "Amount", render: (r) => Number(r.amount ?? 0).toLocaleString("en-IN") },
    { key: "due_date", header: "Due", render: (r) => String(r.due_date ?? "—") },
    { key: "days_overdue", header: "Days", render: (r) => String(r.days_overdue ?? 0) },
    { key: "ageing_bucket", header: "Bucket", render: (r) => String(r.ageing_bucket ?? "—") },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={String(r.status ?? "PENDING")} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle="Receivables and payables with ageing buckets."
      />

      <div className="fleet-grid">
        <StatCard label="AR open" value={`₹${totals.arOpen.toLocaleString("en-IN")}`} />
        <StatCard label="AP open" value={`₹${totals.apOpen.toLocaleString("en-IN")}`} />
        <StatCard label="AR 60+" value={`₹${totals.arOver60.toLocaleString("en-IN")}`} />
        <StatCard label="AP 60+" value={`₹${totals.apOver60.toLocaleString("en-IN")}`} />
      </div>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!loading ? (
        <>
          <section className="panel table-panel">
            <h3>Receivables ageing</h3>
            <DataTable columns={arColumns} rows={ar} rowKey={(r) => r.id} />
          </section>
          <section className="panel table-panel">
            <h3>Payables ageing</h3>
            <DataTable columns={apColumns} rows={ap} rowKey={(r) => r.id} />
          </section>
        </>
      ) : null}
    </>
  );
}
