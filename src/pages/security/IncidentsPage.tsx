import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { incidentFormSchema } from "@/lib/validation";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: "incident_number", header: "Incident #", render: (r) => String(r.incident_number ?? "—") },
  { key: "incident_at", header: "When", render: (r) => String(r.incident_at ?? r.incident_date ?? "—") },
  { key: "title", header: "Title", render: (r) => String(r.title ?? "—") },
  { key: "severity", header: "Severity", render: (r) => String(r.severity ?? "—") },
  { key: "status", header: "Status", render: (r) => String(r.status ?? "—") },
];

const fields = [
  { name: "incident_number", label: "Incident number", type: "text" as const, required: true },
  { name: "title", label: "Title", type: "text" as const, required: true },
  {
    name: "severity",
    label: "Severity",
    type: "select" as const,
    required: true,
    options: [
      { value: "LOW", label: "LOW" },
      { value: "MEDIUM", label: "MEDIUM" },
      { value: "HIGH", label: "HIGH" },
      { value: "CRITICAL", label: "CRITICAL" },
    ],
  },
  {
    name: "status",
    label: "Status",
    type: "select" as const,
    required: true,
    options: [
      { value: "OPEN", label: "OPEN" },
      { value: "INVESTIGATING", label: "INVESTIGATING" },
      { value: "CLOSED", label: "CLOSED" },
    ],
  },
  { name: "description", label: "Description", type: "textarea" as const },
  { name: "location", label: "Location", type: "text" as const },
];

export default function Page() {
  return (
    <ModulePage
      title="Incidents"
      subtitle="Security incidents and severity tracking."
      table="opa_security_incidents"
      moduleKey="security"
      columns={columns}
      fields={fields}
      orderBy={{ column: "incident_at", ascending: false }}
      schema={incidentFormSchema}
      createDefaults={() => {
        const d = new Date().toISOString().slice(0, 10);
        return {
          incident_number: `INC-${d.replace(/-/g, "")}-NEW`,
          severity: "MEDIUM",
          status: "OPEN",
          incident_at: new Date().toISOString(),
        };
      }}
    />
  );
}
