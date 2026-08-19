import type { OpaRole } from "@/types/database";

/** Day-to-day employee / PIN management (CEO/Director Company Admin). */
export function isPinAdmin(role: OpaRole | null | undefined): boolean {
  return role === "COMPANY_ADMIN" || role === "SUPER_ADMIN";
}

/** Developer Override only — emergency reset, full ERP, email recovery. */
export function isDeveloperOverride(role: OpaRole | null | undefined): boolean {
  return role === "SUPER_ADMIN";
}
