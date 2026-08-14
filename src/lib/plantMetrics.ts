import { achievementPct } from "@/lib/productionCalc";
import { countFleet } from "@/lib/loomCodes";
import { demoKpis } from "@/lib/demoData";
import type { OpaLoom, OpaProductionEntry } from "@/types/database";

export type PlantDashboardMetrics = {
  fleet: ReturnType<typeof countFleet>;
  todayProduction: number;
  mtdProduction: number;
  targetMeter: number;
  achievement: number;
  efficiency: number;
  downtimeHours: number;
  yarnStock: number;
  beamStock: number;
  fabricStock: number;
  spareStock: number;
  purchasePending: number;
  grnPending: number;
  maintenancePending: number;
  visitorsToday: number;
  ceoPending: number;
  dailyTrend: Array<{ name: string; value: number }>;
  loomWise: Array<{ name: string; value: number }>;
  dobbyVsPlain: Array<{ name: string; value: number }>;
  efficiencyTrend: Array<{ name: string; value: number }>;
  downtimeByReason: Array<{ name: string; value: number }>;
  yarnConsumption: Array<{ name: string; value: number }>;
  monthlyProduction: Array<{ name: string; value: number }>;
  maintenanceCost: Array<{ name: string; value: number }>;
};

export function buildPlantMetrics(input: {
  looms: OpaLoom[];
  entries?: OpaProductionEntry[];
}): PlantDashboardMetrics {
  const fleet = countFleet(input.looms);
  const k = demoKpis;
  const entries = input.entries ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);

  const todayEntries = entries.filter((e) => e.entry_date === today);
  const mtdEntries = entries.filter((e) => e.entry_date.startsWith(monthPrefix));

  const sumMeters = (rows: OpaProductionEntry[]) =>
    rows.reduce((s, e) => s + (Number(e.production_meter) || 0), 0);

  const todayProduction = todayEntries.length
    ? sumMeters(todayEntries)
    : k.production.actual;
  const mtdProduction = mtdEntries.length
    ? sumMeters(mtdEntries)
    : k.production.actual * 18;
  const targetMeter = k.production.target;
  const achievement = achievementPct(todayProduction, targetMeter);

  const avgEff = (() => {
    const src = todayEntries.length ? todayEntries : entries;
    if (!src.length) return k.production.efficiency;
    return (
      Math.round(
        (src.reduce((s, e) => s + (Number(e.efficiency) || 0), 0) / src.length) * 100,
      ) / 100
    );
  })();

  const downtimeHours = todayEntries.length
    ? Math.round(
        todayEntries.reduce((s, e) => s + (Number(e.downtime_hours) || 0), 0) * 10,
      ) / 10
    : k.downtimeHours;

  const loomWise = (todayEntries.length ? todayEntries : entries)
    .slice(0, 12)
    .map((e, i) => ({
      name:
        input.looms.find((l) => l.id === e.loom_id)?.loom_code ||
        input.looms.find((l) => l.id === e.loom_id)?.loom_number ||
        `L${i + 1}`,
      value: Number(e.production_meter) || 0,
    }));

  const dobbyMeters = input.looms
    .filter((l) => l.loom_type === "DOBBY")
    .reduce((s, l) => {
      const m = entries
        .filter((e) => e.loom_id === l.id)
        .reduce((a, e) => a + (Number(e.production_meter) || 0), 0);
      return s + m;
    }, 0);
  const plainMeters = Math.max(0, (entries.length ? sumMeters(entries) : todayProduction) - dobbyMeters);

  return {
    fleet: {
      ...fleet,
      total: fleet.total || 72,
      dobby: fleet.dobby || 36,
      plain: fleet.plain || 36,
    },
    todayProduction,
    mtdProduction,
    targetMeter,
    achievement,
    efficiency: avgEff,
    downtimeHours,
    yarnStock: 1840,
    beamStock: 126,
    fabricStock: 9200,
    spareStock: k.operations.lowStockItems > 0 ? 640 : 820,
    purchasePending: k.operations.purchasePending,
    grnPending: 4,
    maintenancePending: k.operations.maintenancePending,
    visitorsToday: k.visitorsToday,
    ceoPending: k.ceoMeetingsPending,
    dailyTrend: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name, i) => ({
      name,
      value: Math.round(todayProduction * (0.82 + i * 0.025)),
    })),
    loomWise: loomWise.length
      ? loomWise
      : input.looms.slice(0, 10).map((l, i) => ({
          name: l.loom_code || l.loom_number,
          value: 800 + i * 35,
        })),
    dobbyVsPlain: [
      { name: "Dobby", value: dobbyMeters || Math.round(todayProduction * 0.48) },
      { name: "Plain", value: plainMeters || Math.round(todayProduction * 0.52) },
    ],
    efficiencyTrend: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name, i) => ({
      name,
      value: Math.round((avgEff - 4 + i) * 10) / 10,
    })),
    downtimeByReason: [
      { name: "Warp break", value: 12 },
      { name: "Weft break", value: 9 },
      { name: "Mechanical", value: 7 },
      { name: "Beam change", value: 5 },
      { name: "Other", value: 4 },
    ],
    yarnConsumption: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name, i) => ({
      name,
      value: Math.round(420 + i * 18),
    })),
    monthlyProduction: ["Mar", "Apr", "May", "Jun", "Jul", "Aug"].map((name, i) => ({
      name,
      value: Math.round(mtdProduction * (0.7 + i * 0.05)),
    })),
    maintenanceCost: ["Mar", "Apr", "May", "Jun", "Jul", "Aug"].map((name, i) => ({
      name,
      value: Math.round(1.2 + i * 0.15) * 100000,
    })),
  };
}
