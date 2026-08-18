import { useCallback, useEffect, useState } from "react";
import { listRows, updateRow, type Row } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  LoadingState,
  EmptyState,
  type Column,
} from "@/components/ui";

export default function AlertsPage() {
  const { profile, can } = useAuth();
  const canEdit = can("dashboard", "edit") || can("production", "edit");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listRows("opa_alerts", {
      orderBy: { column: "created_at", ascending: false },
    });
    setRows(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(row: Row) {
    if (!canEdit) return;
    await updateRow(
      "opa_alerts",
      row.id,
      {
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: profile?.id ?? null,
      },
      {
        module: "dashboard",
        user_id: profile?.id,
        user_name: profile?.full_name,
        old_value: row,
      },
    );
    await load();
  }

  const columns: Column<Row>[] = [
    {
      key: "severity",
      header: "Severity",
      render: (r) => <StatusBadge status={String(r.severity ?? "LOW")} />,
    },
    { key: "title", header: "Alert", render: (r) => String(r.title ?? "—") },
    { key: "module", header: "Module", render: (r) => String(r.module ?? "—") },
    {
      key: "is_resolved",
      header: "State",
      render: (r) => (r.is_resolved ? "Resolved" : "Open"),
    },
    {
      key: "actions",
      header: "",
      render: (r) =>
        !r.is_resolved && canEdit ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => void resolve(r)}
          >
            Resolve
          </button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Alerts"
        subtitle="Plant exceptions requiring attention."
      />
      <section className="panel table-panel">
        {loading ? <LoadingState /> : null}
        {!loading && rows.length === 0 ? (
          <EmptyState title="No alerts" description="Plant is clear." />
        ) : null}
        {!loading && rows.length > 0 ? (
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
        ) : null}
      </section>
    </>
  );
}
