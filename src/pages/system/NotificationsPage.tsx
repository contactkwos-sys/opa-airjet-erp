import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  { key: "title", header: "Title", render: (r) => String(r.title ?? "—") },
  { key: "body", header: "Body", render: (r) => String(r.body ?? "—") },
  { key: "channel", header: "Channel", render: (r) => String(r.channel ?? "—") },
  {
    key: "is_read",
    header: "Read",
    render: (r) => (r.is_read ? "Yes" : "No"),
  },
  {
    key: "created_at",
    header: "When",
    render: (r) => String(r.created_at ?? "—"),
  },
];

export default function NotificationsPage() {
  return (
    <ModulePage
      title="Notifications"
      subtitle="In-app alerts and delivery status."
      table="opa_notifications"
      moduleKey="notifications"
      columns={columns}
      fields={[]}
      orderBy={{ column: "created_at", ascending: false }}
      readOnly
    />
  );
}
