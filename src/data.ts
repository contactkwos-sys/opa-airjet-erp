export type LoomStatus = "running" | "stopped" | "breakdown";

export interface Loom {
  id: string;
  shed: string;
  type: "Dobby" | "Plain";
  status: LoomStatus;
  efficiency: number;
  metersToday: number;
}

export const fleet = {
  total: 72,
  running: 64,
  stopped: 5,
  breakdown: 3,
};

export const production = {
  target: 85000,
  actual: 81450,
  efficiency: 92.4,
  dobby: 93.2,
  plain: 91.7,
};

export const operations = {
  breakdownToday: 3,
  maintenancePending: 7,
  lowStockItems: 12,
  purchasePending: 8,
  securityAlerts: 2,
};

/** Deterministic mock fleet matching headline counts */
export function buildLooms(): Loom[] {
  const looms: Loom[] = [];
  let running = 0;
  let stopped = 0;
  let breakdown = 0;

  for (let i = 1; i <= fleet.total; i++) {
    const id = `AJ-${String(i).padStart(3, "0")}`;
    const shed = i <= 36 ? "Shed A" : "Shed B";
    const type: Loom["type"] = i % 3 === 0 ? "Dobby" : "Plain";

    let status: LoomStatus = "running";
    if (breakdown < fleet.breakdown && i % 23 === 0) {
      status = "breakdown";
      breakdown++;
    } else if (stopped < fleet.stopped && i % 13 === 0) {
      status = "stopped";
      stopped++;
    } else if (running < fleet.running) {
      status = "running";
      running++;
    } else if (stopped < fleet.stopped) {
      status = "stopped";
      stopped++;
    } else {
      status = "breakdown";
      breakdown++;
    }

    const baseEff = type === "Dobby" ? production.dobby : production.plain;
    const efficiency =
      status === "running"
        ? Math.round((baseEff + ((i % 5) - 2) * 0.4) * 10) / 10
        : status === "stopped"
          ? 0
          : Math.round((baseEff * 0.35 + (i % 7)) * 10) / 10;

    const metersToday =
      status === "running"
        ? Math.round(980 + (i % 11) * 37 + (type === "Dobby" ? 40 : 0))
        : status === "stopped"
          ? Math.round(200 + (i % 5) * 40)
          : Math.round(80 + (i % 9) * 15);

    looms.push({ id, shed, type, status, efficiency, metersToday });
  }

  return looms;
}

export const navItems = [
  { id: "dashboard", label: "Dashboard" },
  { id: "looms", label: "Looms" },
  { id: "production", label: "Production" },
  { id: "maintenance", label: "Maintenance" },
  { id: "inventory", label: "Inventory" },
  { id: "purchase", label: "Purchase" },
  { id: "security", label: "Security" },
] as const;

export type NavId = (typeof navItems)[number]["id"];
