import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listRows, type Row } from "@/lib/api";
import { PageHeader, TextInput, LoadingState, EmptyState } from "@/components/ui";

type Hit = {
  id: string;
  entity: string;
  title: string;
  subtitle: string;
  to: string;
};

const SOURCES: Array<{
  table: string;
  entity: string;
  to: (id: string) => string;
  title: (r: Record<string, unknown>) => string;
  subtitle: (r: Record<string, unknown>) => string;
  keys: string[];
}> = [
  {
    table: "opa_looms",
    entity: "Loom",
    to: (id) => `/looms/${id}`,
    title: (r) => String(r.loom_number ?? r.id),
    subtitle: (r) => `${r.loom_type ?? ""} · ${r.status ?? ""}`,
    keys: ["loom_number", "status", "location", "current_article"],
  },
  {
    table: "opa_customers",
    entity: "Customer",
    to: () => "/customers",
    title: (r) => String(r.name ?? r.customer_code),
    subtitle: (r) => String(r.city ?? r.mobile ?? ""),
    keys: ["name", "customer_code", "city", "mobile"],
  },
  {
    table: "opa_suppliers",
    entity: "Supplier",
    to: () => "/suppliers",
    title: (r) => String(r.name ?? r.supplier_code),
    subtitle: (r) => String(r.city ?? r.mobile ?? ""),
    keys: ["name", "supplier_code", "city", "mobile"],
  },
  {
    table: "opa_employees",
    entity: "Employee",
    to: () => "/employees",
    title: (r) => String(r.full_name ?? r.employee_code),
    subtitle: (r) => String(r.designation ?? ""),
    keys: ["full_name", "employee_code", "designation", "department"],
  },
  {
    table: "opa_visitors",
    entity: "Visitor",
    to: () => "/security/visitors",
    title: (r) => String(r.full_name ?? r.visitor_code),
    subtitle: (r) => String(r.company ?? r.mobile ?? ""),
    keys: ["full_name", "visitor_code", "company", "mobile"],
  },
  {
    table: "opa_purchase_orders",
    entity: "PO",
    to: () => "/purchase-orders",
    title: (r) => String(r.po_number ?? r.id),
    subtitle: (r) => `${r.status ?? ""} · ₹${r.total_amount ?? 0}`,
    keys: ["po_number", "status", "remarks"],
  },
  {
    table: "opa_sales_orders",
    entity: "SO",
    to: () => "/orders",
    title: (r) => String(r.so_number ?? r.id),
    subtitle: (r) => `${r.status ?? ""} · ₹${r.total_amount ?? 0}`,
    keys: ["so_number", "status", "remarks"],
  },
  {
    table: "opa_ceo_visit_requests",
    entity: "CEO visit",
    to: () => "/security/ceo-visits",
    title: (r) => String(r.request_number ?? r.visitor_name),
    subtitle: (r) => `${r.status ?? ""} · ${r.purpose ?? ""}`,
    keys: ["request_number", "visitor_name", "purpose", "status"],
  },
];

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async (query: string) => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < 2) {
      setHits([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    const out: Hit[] = [];
    const results = await Promise.all(
      SOURCES.map(async (src) => {
        const result = await listRows(src.table, { limit: 100 });
        return { src, rows: result.data as Row[] };
      }),
    );
    for (const { src, rows } of results) {
      for (const row of rows) {
        const hay = src.keys.map((k) => String(row[k] ?? "")).join(" ").toLowerCase();
        if (!hay.includes(trimmed)) continue;
        out.push({
          id: `${src.table}-${row.id}`,
          entity: src.entity,
          title: src.title(row),
          subtitle: src.subtitle(row),
          to: src.to(row.id),
        });
      }
    }
    setHits(out.slice(0, 40));
    setLoading(false);
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void runSearch(q);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [q, runSearch]);

  return (
    <>
      <PageHeader
        title="Search"
        subtitle="Global search across looms, partners, documents and visits."
      />
      <section className="panel page-card">
        <TextInput
          label="Search"
          placeholder="Try loom, customer, PO, visitor…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </section>
      <section className="panel table-panel">
        {q.trim().length < 2 ? (
          <p className="muted">Type at least 2 characters.</p>
        ) : loading ? (
          <LoadingState label="Searching…" />
        ) : hits.length === 0 && searched ? (
          <EmptyState title="No data available" description="No matches for this query." />
        ) : (
          <ul className="search-results">
            {hits.map((h) => (
              <li key={h.id}>
                <Link to={h.to}>
                  <strong>{h.title}</strong>
                  <span className="search-entity">{h.entity}</span>
                  <span className="muted">{h.subtitle}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
