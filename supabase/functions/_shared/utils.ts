export function corsHeaders(origin?: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  };
}

export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function buildCeoMessage(params: {
  request_id: string;
  visitor_name: string;
  company_name: string;
  mobile: string;
  purpose: string;
  date: string;
  time: string;
  number_of_visitors: number;
  security_user: string;
  approval_link: string;
  rejection_link: string;
  reschedule_link: string;
}): string {
  return [
    "OPA GROUP OF INDIA",
    "",
    "CEO VISITING REQUEST",
    "",
    `Request ID: ${params.request_id}`,
    "",
    "Visitor:",
    params.visitor_name,
    "",
    "Company:",
    params.company_name,
    "",
    "Mobile:",
    params.mobile,
    "",
    "Purpose:",
    params.purpose,
    "",
    "Requested Date:",
    params.date,
    "",
    "Requested Time:",
    params.time,
    "",
    "Visitors:",
    String(params.number_of_visitors),
    "",
    "Requested by Security:",
    params.security_user,
    "",
    "Please review this visiting request.",
    "",
    "APPROVE:",
    params.approval_link,
    "",
    "REJECT:",
    params.rejection_link,
    "",
    "RESCHEDULE:",
    params.reschedule_link,
  ].join("\n");
}
