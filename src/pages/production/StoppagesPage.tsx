import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { stoppageFormSchema } from "@/lib/validation";

type Row = Record<string, unknown> & { id: string };

/** Aligned with opa_stoppage_reason enum + master-spec wording in labels. */
const REASONS = [
  { value: "MECHANICAL_FAULT", label: "Mechanical" },
  { value: "ELECTRONIC_FAULT", label: "Electrical / Electronic" },
  { value: "WARP_BREAK", label: "Warp" },
  { value: "WEFT_BREAK", label: "Weft / Yarn" },
  { value: "BEAM_CHANGE", label: "Beam" },
  { value: "DOBBY_FAULT", label: "Dobby" },
  { value: "QUALITY_HOLD", label: "Quality" },
  { value: "REED_CHANGE", label: "Setting / Reed" },
  { value: "POWER_FAILURE", label: "Power Failure" },
  { value: "PLANNED_MAINTENANCE", label: "Maintenance" },
  { value: "BREAKDOWN", label: "Breakdown" },
  { value: "AIR_PRESSURE", label: "Air Pressure" },
  { value: "NO_BEAM", label: "No Beam" },
  { value: "NO_OPERATOR", label: "No Operator" },
  { value: "OTHER", label: "Other" },
];

function durationHours(start?: unknown, end?: unknown) {
  if (!start) return "—";
  const s = new Date(String(start)).getTime();
  const e = end ? new Date(String(end)).getTime() : Date.now();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return "—";
  return `${((e - s) / 3600000).toFixed(2)} h`;
}

const columns: Column<Row>[] = [
  { key: "loom_id", header: "Loom", render: (r) => String(r.loom_id ?? "—").slice(0, 12) },
  { key: "reason", header: "Reason", render: (r) => String(r.reason ?? "—") },
  {
    key: "start_time",
    header: "Start",
    render: (r) => String(r.start_time ?? "—").slice(0, 16),
  },
  {
    key: "end_time",
    header: "End",
    render: (r) => (r.end_time ? String(r.end_time).slice(0, 16) : "Open"),
  },
  {
    key: "duration",
    header: "Duration",
    render: (r) => durationHours(r.start_time, r.end_time),
  },
  { key: "department", header: "Dept", render: (r) => String(r.department ?? "—") },
  { key: "remarks", header: "Remarks", render: (r) => String(r.remarks ?? "—") },
];

const fields = [
  {
    name: "loom_id",
    label: "Loom ID",
    type: "text" as const,
    required: true,
    placeholder: "demo-loom-13",
  },
  {
    name: "reason",
    label: "Reason",
    type: "select" as const,
    required: true,
    options: REASONS,
  },
  {
    name: "start_time",
    label: "Start time",
    type: "datetime-local" as const,
    required: true,
  },
  {
    name: "end_time",
    label: "End time",
    type: "datetime-local" as const,
  },
  {
    name: "department",
    label: "Department",
    type: "select" as const,
    options: [
      { value: "MECHANICAL", label: "MECHANICAL" },
      { value: "ELECTRICAL", label: "ELECTRICAL" },
      { value: "ELECTRONICS", label: "ELECTRONICS" },
      { value: "LOOM", label: "LOOM" },
      { value: "UTILITY", label: "UTILITY" },
      { value: "PRODUCTION", label: "PRODUCTION" },
      { value: "QUALITY", label: "QUALITY" },
    ],
  },
  { name: "remarks", label: "Remarks", type: "textarea" as const },
];

export default function StoppagesPage() {
  return (
    <ModulePage
      title="Loom Stoppage / Downtime"
      subtitle="Manual stoppage entry with automatic duration. Linked to loom master."
      table="opa_loom_stoppages"
      moduleKey="production"
      columns={columns}
      fields={fields}
      orderBy={{ column: "start_time", ascending: false }}
      schema={stoppageFormSchema}
      createDefaults={() => {
        const now = new Date();
        const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        return {
          reason: "OTHER",
          start_time: local,
          department: "LOOM",
        };
      }}
    />
  );
}
