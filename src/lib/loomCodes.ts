import type { LoomStatus, LoomType, OpaLoom } from "@/types/database";

/** Canonical short codes: D01–D36, P01–P36 */
export function loomCodeFromIndex(index1to72: number): { code: string; type: LoomType } {
  if (index1to72 <= 36) {
    return { code: `D${String(index1to72).padStart(2, "0")}`, type: "DOBBY" };
  }
  return { code: `P${String(index1to72 - 36).padStart(2, "0")}`, type: "PLAIN" };
}

export function displayLoomNumber(loom: Pick<OpaLoom, "loom_number" | "loom_code">): string {
  return (loom.loom_code || loom.loom_number || "").trim();
}

export function countFleet(looms: OpaLoom[]) {
  const counts = {
    total: looms.length,
    dobby: 0,
    plain: 0,
    running: 0,
    stopped: 0,
    breakdown: 0,
    maintenance: 0,
    idle: 0,
  };
  for (const l of looms) {
    if (l.loom_type === "DOBBY") counts.dobby++;
    else counts.plain++;
    const s = l.status as LoomStatus;
    if (s === "RUNNING") counts.running++;
    else if (s === "STOPPED") counts.stopped++;
    else if (s === "BREAKDOWN") counts.breakdown++;
    else if (s === "MAINTENANCE") counts.maintenance++;
    else counts.idle++;
  }
  return counts;
}
