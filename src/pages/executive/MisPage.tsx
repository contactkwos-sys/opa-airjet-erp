import { useCallback, useEffect, useMemo, useState } from "react";
import { listRows, type Row } from "@/lib/api";
import { demoKpis } from "@/lib/demoData";
import { useAuth } from "@/context/AuthContext";
import {
  PageHeader,
  StatCard,
  DataTable,
  LoadingState,
  AlertBanner,
  type Column,
} from "@/components/ui";

export default function MisPage() {
  const { demoMode } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fromDemo, setFromDemo] = useState(false);
  const [stoppages, setStoppages] = useState<Row[]>([]);
  const [quality, setQuality] = useState<Row[]>([]);
  const [prs, setPrs] = useState<Row[]>([]);
  const [maint, setMaint] = useState<Row[]>([]);
  const [visitors, setVisitors] = useState<Row[]>([]);
  const [ceoVisits, setCeoVisits] = useState<Row[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [
      stopRes,
      qcRes,
      prRes,
      mrRes,
      visRes,
      ceoRes,
    ] = await Promise.all([
      listRows("opa_loom_stoppages", {
        orderBy: { column: "start_time", ascending: false },
        limit: 50,
      }),
      listRows("opa_quality_inspections", {
        orderBy: { column: "inspection_date", ascending: false },
        limit: 50,
      }),
      listRows("opa_purchase_requisitions", {
        orderBy: { column: "request_date", ascending: false },
        limit: 50,
      }),
      listRows("opa_maintenance_requests", {
        orderBy: { column: "request_date", ascending: false },
        limit: 50,
      }),
      listRows("opa_visitors", { limit: 50 }),
      listRows("opa_ceo_visit_requests", {
        orderBy: { column: "proposed_visit_at", ascending: false },
        limit: 50,
      }),
    ]);

    setStoppages(stopRes.data);
    setQuality(qcRes.data);
    setPrs(prRes.data);
    setMaint(mrRes.data);
    setVisitors(visRes.data);
    setCeoVisits(ceoRes.data);
    setFromDemo(
      stopRes.fromDemo ||
        qcRes.fromDemo ||
        prRes.fromDemo ||
        mrRes.fromDemo ||
        visRes.fromDemo ||
        ceoRes.fromDemo,
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const openStoppages = stoppages.filter((s) => !s.end_time).length;
    const rejects = quality.filter(
      (q) => q.result === "FAIL" || q.result === "HOLD" || q.result === "REWORK",
    ).length;
    const pendingPurchase = prs.filter(
      (p) =>
        p.status === "DRAFT" ||
        p.status === "SUBMITTED" ||
        p.status === "APPROVED",
    ).length;
    const openMaint = maint.filter(
      (m) =>
        m.status === "OPEN" ||
        m.status === "ASSIGNED" ||
        m.status === "IN_PROGRESS",
    ).length;
    const pendingCeo = ceoVisits.filter((c) => c.status === "PENDING").length;
    return {
      openStoppages,
      rejects,
      pendingPurchase,
      openMaint,
      visitors: visitors.length || demoKpis.visitorsToday,
      pendingCeo: pendingCeo || demoKpis.ceoMeetingsPending,
    };
  }, [stoppages, quality, prs, maint, visitors, ceoVisits]);

  const stopColumns: Column<Row>[] = [
    { key: "loom_id", header: "Loom", render: (r) => String(r.loom_id ?? "—") },
    { key: "reason", header: "Reason", render: (r) => String(r.reason ?? "—") },
    {
      key: "start_time",
      header: "Start",
      render: (r) => String(r.start_time ?? "—").slice(0, 16),
    },
  ];

  const purchaseColumns: Column<Row>[] = [
    { key: "pr_number", header: "PR #", render: (r) => String(r.pr_number ?? "—") },
    { key: "priority", header: "Priority", render: (r) => String(r.priority ?? "—") },
    { key: "status", header: "Status", render: (r) => String(r.status ?? "—") },
  ];

  const maintColumns: Column<Row>[] = [
    {
      key: "request_number",
      header: "Request #",
      render: (r) => String(r.request_number ?? "—"),
    },
    { key: "priority", header: "Priority", render: (r) => String(r.priority ?? "—") },
    { key: "status", header: "Status", render: (r) => String(r.status ?? "—") },
  ];

  return (
    <>
      <PageHeader
        title="Management MIS"
        subtitle="CEO / management snapshot across production, quality, purchase, maintenance and security."
        meta={
          demoMode || fromDemo ? (
            <span className="live-chip">Demo Mode</span>
          ) : null
        }
      />

      {fromDemo || demoMode ? (
        <AlertBanner tone="info" title="Demo data">
          Summaries use live rows when available, otherwise demo KPIs and sample
          tables.
        </AlertBanner>
      ) : null}

      {loading ? (
        <LoadingState label="Loading MIS…" />
      ) : (
        <>
          <div className="fleet-grid">
            <StatCard
              label="Production (M)"
              value={demoKpis.production.actual.toLocaleString("en-IN")}
              hint={`${demoKpis.production.efficiency}% efficiency`}
            />
            <StatCard
              label="Downtime (hrs)"
              value={demoKpis.downtimeHours}
              hint={`${summary.openStoppages} open stoppages`}
            />
            <StatCard
              label="Rejection"
              value={`${demoKpis.rejectionPct}%`}
              hint={`${summary.rejects} hold/fail/rework`}
            />
            <StatCard
              label="Purchase pending"
              value={`₹${demoKpis.purchasePendingValue}L`}
              hint={`${summary.pendingPurchase} open PRs`}
            />
            <StatCard
              label="Maintenance open"
              value={summary.openMaint}
              hint="Requests in progress"
            />
            <StatCard
              label="Visitors / CEO"
              value={`${summary.visitors} / ${summary.pendingCeo}`}
              hint="Visitors · pending CEO visits"
            />
          </div>

          <div className="split-panels">
            <section className="panel table-panel">
              <h2 className="panel-title">Recent stoppages</h2>
              <DataTable
                columns={stopColumns}
                rows={stoppages.slice(0, 6)}
                rowKey={(r) => r.id}
              />
            </section>
            <section className="panel table-panel">
              <h2 className="panel-title">Purchase pending</h2>
              <DataTable
                columns={purchaseColumns}
                rows={prs
                  .filter((p) =>
                    ["DRAFT", "SUBMITTED", "APPROVED"].includes(
                      String(p.status),
                    ),
                  )
                  .slice(0, 6)}
                rowKey={(r) => r.id}
              />
            </section>
            <section className="panel table-panel">
              <h2 className="panel-title">Maintenance open</h2>
              <DataTable
                columns={maintColumns}
                rows={maint
                  .filter((m) =>
                    ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(
                      String(m.status),
                    ),
                  )
                  .slice(0, 6)}
                rowKey={(r) => r.id}
              />
            </section>
          </div>
        </>
      )}
    </>
  );
}
