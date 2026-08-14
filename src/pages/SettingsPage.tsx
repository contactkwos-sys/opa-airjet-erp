import { PageHeader, StatCard } from "@/components/ui";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Company and plant configuration for OPA Air Jet Loom ERP."
      />
      <div className="fleet-grid">
        <StatCard label="Company" value="OPA Group of India" />
        <StatCard label="Timezone" value="Asia/Kolkata" />
        <StatCard label="Currency" value="INR" />
        <StatCard label="Loom capacity" value={72} hint="36 Dobby · 36 Plain" />
      </div>
      <section className="panel page-card">
        <h3>Plant defaults</h3>
        <p>
          Configure costing formulas, approval thresholds, WhatsApp CEO-visit
          notifications, and fiscal year from the company settings record once
          Supabase is connected.
        </p>
      </section>
    </>
  );
}
