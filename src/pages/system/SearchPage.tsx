import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getDemoRows } from "@/lib/demoData";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, TextInput } from "@/components/ui";

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
  const { demoMode } = useAuth();
  const [q, setQ] = useState("");

  const hits = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 2) return [] as Hit[];
    const out: Hit[] = [];
    for (const src of SOURCES) {
      const rows = getDemoRows(src.table);
      for (const row of rows) {
        const hay = src.keys.map((k) => String(row[k] ?? "")).join(" ").toLowerCase();
        if (!hay.includes(query)) continue;
        out.push({
          id: `${src.table}-${row.id}`,
          entity: src.entity,
          title: src.title(row),
          subtitle: src.subtitle(row),
          to: src.to(row.id),
        });
      }
    }
    return out.slice(0, 40);
  }, [q]);

  return (
    <>
      <PageHeader
        title="Search"
        subtitle="Global search across looms, partners, documents and visits."
        meta={demoMode ? <span className="live-chip">Demo Mode</span> : null}
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
        ) : hits.length === 0 ? (
          <p className="muted">No matches.</p>
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
