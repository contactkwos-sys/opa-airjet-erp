import type { OpaRole } from "@/types/database";
import { ROLE_PIN_LABELS } from "@/lib/rolePins";

/** Build a shareable deep link that opens /login with role + employee preselected. */
export function buildEmployeeLoginLink(params: {
  origin: string;
  role: OpaRole;
  employeeId: string;
}): string {
  const url = new URL("/login", params.origin);
  url.searchParams.set("role", params.role);
  url.searchParams.set("e", params.employeeId);
  return url.toString();
}

/** Plain-text message CEO/Director can paste into WhatsApp / SMS. */
export function buildEmployeeAccessMessage(params: {
  origin: string;
  role: OpaRole;
  employeeId: string;
  displayName: string;
  pin?: string | null;
}): string {
  const link = buildEmployeeLoginLink(params);
  const roleLabel = ROLE_PIN_LABELS[params.role] ?? params.role;
  const lines = [
    "OPA Group of India — Air Jet Loom ERP",
    "",
    `Hello ${params.displayName},`,
    `Your login role: ${roleLabel}`,
  ];
  if (params.pin && /^\d{4}$/.test(params.pin)) {
    lines.push(`Your PIN: ${params.pin}`);
  }
  lines.push("", "Open this link, confirm your name, then enter your PIN:", link);
  return lines.join("\n");
}

export function whatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function shareOrCopy(message: string): Promise<"shared" | "copied" | "failed"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: "OPA ERP login",
        text: message,
      });
      return "shared";
    } catch (err) {
      // User cancelled share sheet — not a failure to report loudly.
      if (err instanceof DOMException && err.name === "AbortError") {
        return "failed";
      }
    }
  }
  const ok = await copyText(message);
  return ok ? "copied" : "failed";
}
