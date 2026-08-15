/** Production field calculations (client-side; DB also stores generated meters). */

export type ProductionCalcInput = {
  opening_meter: number;
  closing_meter: number;
  production_kg?: number | null;
  waste_kg?: number | null;
  running_hours?: number | null;
  stop_hours?: number | null;
  /** Shift length hours used when deriving efficiency (default 8). */
  shift_hours?: number;
  gsm?: number | null;
  fabric_width?: number | null;
};

export type ProductionCalcResult = {
  production_meter: number;
  production_kg: number;
  waste_kg: number;
  waste_percentage: number;
  running_hours: number;
  downtime_hours: number;
  efficiency: number;
};

export function calculateProduction(input: ProductionCalcInput): ProductionCalcResult {
  const opening = Number(input.opening_meter) || 0;
  const closing = Number(input.closing_meter) || 0;
  const production_meter = Math.max(0, closing - opening);
  const waste_kg = Math.max(0, Number(input.waste_kg) || 0);

  let production_kg = Number(input.production_kg);
  if (!Number.isFinite(production_kg) || production_kg <= 0) {
    const gsm = Number(input.gsm) || 0;
    const widthCm = Number(input.fabric_width) || 0;
    if (gsm > 0 && widthCm > 0 && production_meter > 0) {
      // approx kg = meters * width(m) * gsm / 1000
      production_kg = (production_meter * (widthCm / 100) * gsm) / 1000;
    } else {
      production_kg = production_meter * 0.18;
    }
  }
  production_kg = Math.round(production_kg * 1000) / 1000;

  const waste_percentage =
    production_kg > 0 ? Math.round((waste_kg / (production_kg + waste_kg)) * 10000) / 100 : 0;

  const shiftHours = Number(input.shift_hours) > 0 ? Number(input.shift_hours) : 8;
  let running_hours = Number(input.running_hours);
  let downtime_hours = Number(input.stop_hours);
  if (!Number.isFinite(running_hours) || running_hours < 0) running_hours = shiftHours;
  if (!Number.isFinite(downtime_hours) || downtime_hours < 0) {
    downtime_hours = Math.max(0, shiftHours - running_hours);
  }
  running_hours = Math.min(shiftHours, Math.max(0, running_hours));
  downtime_hours = Math.min(shiftHours, Math.max(0, downtime_hours));

  const efficiency =
    shiftHours > 0
      ? Math.round((running_hours / shiftHours) * 10000) / 100
      : 0;

  return {
    production_meter: Math.round(production_meter * 1000) / 1000,
    production_kg,
    waste_kg,
    waste_percentage,
    running_hours,
    downtime_hours,
    efficiency,
  };
}

export function achievementPct(actual: number, target: number): number {
  if (!target || target <= 0) return 0;
  return Math.round((actual / target) * 10000) / 100;
}

export type RagLevel = "red" | "amber" | "green";

export function achievementRag(pct: number): RagLevel {
  if (pct >= 95) return "green";
  if (pct >= 80) return "amber";
  return "red";
}
