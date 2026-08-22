import type { OpaRole } from "@/types/database";

/** Day-to-day employee / PIN management (CEO, Director, legacy Company Admin, Developer). */
export function isPinAdmin(role: OpaRole | null | undefined): boolean {
  return (
    role === "CEO" ||
    role === "DIRECTOR" ||
    role === "COMPANY_ADMIN" ||
    role === "SUPER_ADMIN"
  );
}

/** Developer Override only — emergency reset, full ERP, email recovery. */
export function isDeveloperOverride(role: OpaRole | null | undefined): boolean {
  return role === "SUPER_ADMIN";
}
