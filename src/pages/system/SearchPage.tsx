import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getDemoRows } from "@/lib/demoData";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, TextInput, AlertBanner } from "@/components/ui";

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
    title: (r) => String(r.loom_code ?? r.loom_number ?? r.id),
    subtitle: (r) => `${r.loom_type ?? ""} · ${r.status ?? ""} · ${r.location ?? ""}`,
    keys: ["loom_number", "loom_code", "status", "location", "current_article", "loom_type"],
  },
  {
    table: "opa_inventory_items",
    entity: "Item",
    to: () => "/inventory",
    title: (r) => String(r.item_code ?? r.name ?? r.id),
    subtitle: (r) => `${r.name ?? ""} · ${r.category ?? ""} · qty ${r.current_qty ?? "—"}`,
    keys: ["item_code", "name", "category"],
  },
  {
    table: "opa_yarn_master",
    entity: "Yarn",
    to: () => "/yarn",
    title: (r) => String(r.yarn_code ?? r.name ?? r.id),
    subtitle: (r) => `${r.name ?? ""} · ${r.count ?? ""} · ${r.blend ?? ""}`,
    keys: ["yarn_code", "name", "count", "blend", "color"],
  },
  {
    table: "opa_beams",
    entity: "Beam",
    to: () => "/beams",
    title: (r) => String(r.beam_number ?? r.id),
    subtitle: (r) => `${r.status ?? ""} · ${r.length_meters ?? "—"} M`,
    keys: ["beam_number", "status"],
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
    subtitle: (r) => `${r.visitor_code ?? ""} · ${r.company ?? ""} · ${r.mobile ?? ""}`,
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

const QUICK = ["D01", "P10", "YARN", "PO", "VIS-001", "Amit"];

export default function SearchPage() {
  const { demoMode } = useAuth();
  const [q, setQ] = useState("");

  const hits = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 1) return [] as Hit[];
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
    return out.slice(0, 50);
  }, [q]);

  return (
    <>
      <PageHeader
        title="Global Search"
        subtitle="Find looms (D01–D36 / P01–P36), items, POs, visitors and more."
        meta={demoMode ? <span className="live-chip">Demo Mode</span> : null}
      />

      <section className="panel page-card">
        <TextInput
          label="Search"
          placeholder="Try D01, yarn, PO number, VIS-001…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <div className="search-quick" style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {QUICK.map((term) => (
            <button
              key={term}
              type="button"
              className="btn btn-ghost"
              onClick={() => setQ(term)}
            >
              {term}
            </button>
          ))}
        </div>
      </section>

      {!q.trim() ? (
        <AlertBanner tone="info" title="Tips">
          Search demo looms by code (D01, P36), inventory item codes, purchase order numbers, or
          visitor labels such as VIS-001 / company name.
        </AlertBanner>
      ) : null}

      <section className="panel table-panel">
        {!q.trim() ? (
          <p className="muted">Start typing to search across ERP entities.</p>
        ) : hits.length === 0 ? (
          <p className="muted">No matches for “{q.trim()}”.</p>
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
