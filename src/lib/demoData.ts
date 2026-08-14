import type { LoomStatus, LoomType, OpaLoom, OpaProductionEntry } from "@/types/database";
import { fleet, production as prodDemo, operations } from "@/data";

/** Demo looms matching seed naming: DOBBY 01-36, PLAIN 37-72 */
export function buildDemoLooms(): OpaLoom[] {
  const now = new Date().toISOString();
  const looms: OpaLoom[] = [];
  let running = 0;
  let stopped = 0;
  let breakdown = 0;

  for (let i = 1; i <= 72; i++) {
    const loom_type: LoomType = i <= 36 ? "DOBBY" : "PLAIN";
    const loom_number =
      loom_type === "DOBBY"
        ? `DOBBY LOOM ${String(i).padStart(2, "0")}`
        : `PLAIN LOOM ${String(i).padStart(2, "0")}`;

    let status: LoomStatus = "RUNNING";
    if (breakdown < fleet.breakdown && i % 23 === 0) {
      status = "BREAKDOWN";
      breakdown++;
    } else if (stopped < fleet.stopped && i % 13 === 0) {
      status = "STOPPED";
      stopped++;
    } else if (running < fleet.running) {
      status = "RUNNING";
      running++;
    } else if (stopped < fleet.stopped) {
      status = "STOPPED";
      stopped++;
    } else {
      status = "BREAKDOWN";
      breakdown++;
    }

    looms.push({
      id: `demo-loom-${i}`,
      loom_number,
      loom_type,
      make: "Toyota",
      model: loom_type === "DOBBY" ? "JAT810-D" : "JAT810",
      serial_number: `SN-${1000 + i}`,
      installation_date: "2022-01-15",
      width: 190,
      reed: 72,
      pick: 68,
      rpm: status === "RUNNING" ? 850 : 0,
      motor: "AC",
      controller: "Electronic",
      dobby_unit: loom_type === "DOBBY" ? "Staubli" : null,
      electronic_components: [],
      current_article: status === "RUNNING" ? `ART-${(i % 12) + 1}` : null,
      current_quality: "A",
      current_operator_id: null,
      current_shift_id: null,
      status,
      location: i <= 36 ? "Shed A" : "Shed B",
      notes: null,
      is_active: true,
      created_at: now,
      updated_at: now,
    });
  }
  return looms;
}

export function buildDemoProductionEntries(looms: OpaLoom[]): OpaProductionEntry[] {
  const today = new Date().toISOString().slice(0, 10);
  return looms.slice(0, 18).map((loom, idx) => {
    const opening = 1000 + idx * 50;
    const prod = loom.status === "RUNNING" ? 900 + (idx % 7) * 40 : 120 + idx * 5;
    return {
      id: `demo-pe-${idx}`,
      entry_number: `PE-${today.replace(/-/g, "")}-${String(idx + 1).padStart(3, "0")}`,
      entry_date: today,
      shift_id: null,
      loom_id: loom.id,
      article_id: null,
      opening_meter: opening,
      closing_meter: opening + prod,
      production_meter: prod,
      production_kg: Math.round(prod * 0.18 * 10) / 10,
      running_hours: loom.status === "RUNNING" ? 7.5 : 2,
      downtime_hours: loom.status === "RUNNING" ? 0.5 : 5,
      efficiency: loom.status === "RUNNING" ? 90 + (idx % 8) : 35,
      operator_id: null,
      supervisor_id: null,
      remarks: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
}

export const demoKpis = {
  fleet,
  production: prodDemo,
  operations,
  rejectionPct: 1.8,
  downtimeHours: 42,
  costPerMeter: 18.4,
  inventoryValueLakh: 128,
  purchasePendingValue: 6.4,
  visitorsToday: 14,
  ceoMeetingsPending: 2,
  dispatchMeters: 24500,
  receivablesLakh: 86,
};
