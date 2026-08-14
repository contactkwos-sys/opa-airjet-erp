// Supabase Edge Function: ceo-visit-action
// Secure mobile approve / reject / reschedule API for CEO visit requests.
// Validates action_token; never logs secrets.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Action = "approve" | "reject" | "reschedule";

type ActionBody = {
  request_id?: string;
  token?: string;
  action?: Action;
  notes?: string;
  proposed_times?: string[];
  approved_visit_at?: string;
};

function htmlPage(title: string, body: string, ok = true): Response {
  const color = ok ? "#0f766e" : "#b91c1c";
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 420px; margin: 40px auto; background: #fff; border-radius: 12px;
      padding: 24px; box-shadow: 0 8px 24px rgba(15,23,42,.08); }
    h1 { color: ${color}; font-size: 1.25rem; margin: 0 0 8px; }
    p { color: #334155; line-height: 1.5; }
    label { display: block; margin-top: 12px; font-size: .875rem; color: #475569; }
    input, textarea { width: 100%; margin-top: 4px; padding: 10px; border: 1px solid #cbd5e1;
      border-radius: 8px; box-sizing: border-box; }
    button { margin-top: 16px; width: 100%; padding: 12px; border: 0; border-radius: 8px;
      background: ${color}; color: #fff; font-weight: 600; }
  </style>
</head>
<body><div class="card">${body}</div></body>
</html>`;
  return new Response(doc, {
    status: ok ? 200 : 400,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseActionFromPath(pathname: string): Action | null {
  if (pathname.endsWith("/approve")) return "approve";
  if (pathname.endsWith("/reject")) return "reject";
  if (pathname.endsWith("/reschedule")) return "reschedule";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathAction = parseActionFromPath(url.pathname);

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    // GET: render simple mobile action page
    if (req.method === "GET") {
      const requestId = url.searchParams.get("request_id") || "";
      const token = url.searchParams.get("token") || "";
      const action = pathAction || (url.searchParams.get("action") as Action | null);

      if (!requestId || !token || !action) {
        return htmlPage(
          "Invalid link",
          "<h1>Invalid link</h1><p>This visit action link is incomplete or expired.</p>",
          false,
        );
      }

      if (action === "reschedule") {
        return htmlPage(
          "Reschedule visit",
          `<h1>Reschedule visit</h1>
           <p>Propose new visit time(s) for OPA Group.</p>
           <form method="POST" action="${url.pathname}">
             <input type="hidden" name="request_id" value="${requestId}" />
             <input type="hidden" name="token" value="${token}" />
             <input type="hidden" name="action" value="reschedule" />
             <label>Proposed times (comma-separated ISO or readable)
               <textarea name="proposed_times" rows="3" required></textarea>
             </label>
             <label>Notes
               <textarea name="notes" rows="2"></textarea>
             </label>
             <button type="submit">Submit reschedule</button>
           </form>`,
        );
      }

      const label = action === "approve" ? "Approve" : "Reject";
      return htmlPage(
        `${label} visit`,
        `<h1>${label} visit</h1>
         <p>Confirm ${action} for this CEO visit request.</p>
         <form method="POST" action="${url.pathname}">
           <input type="hidden" name="request_id" value="${requestId}" />
           <input type="hidden" name="token" value="${token}" />
           <input type="hidden" name="action" value="${action}" />
           <label>Notes
             <textarea name="notes" rows="2"></textarea>
           </label>
           <button type="submit">${label}</button>
         </form>`,
      );
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = req.headers.get("content-type") || "";
    let payload: ActionBody = {};

    if (contentType.includes("application/json")) {
      payload = (await req.json()) as ActionBody;
    } else {
      const form = await req.formData();
      const proposed = String(form.get("proposed_times") || "");
      payload = {
        request_id: String(form.get("request_id") || ""),
        token: String(form.get("token") || ""),
        action: (String(form.get("action") || pathAction || "") as Action) || undefined,
        notes: String(form.get("notes") || "") || undefined,
        proposed_times: proposed
          ? proposed.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
        approved_visit_at: String(form.get("approved_visit_at") || "") || undefined,
      };
    }

    const requestId = payload.request_id || url.searchParams.get("request_id") || "";
    const token = payload.token || url.searchParams.get("token") || "";
    const action = payload.action || pathAction;

    if (!requestId || !token || !action) {
      const wantsHtml = !contentType.includes("application/json");
      if (wantsHtml) {
        return htmlPage("Missing data", "<h1>Missing data</h1><p>request_id, token and action are required.</p>", false);
      }
      return new Response(JSON.stringify({ error: "request_id, token and action are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["approve", "reject", "reschedule"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: visit, error } = await supabase
      .from("opa_ceo_visit_requests")
      .select("id, status, action_token, action_token_expires_at, proposed_times")
      .eq("id", requestId)
      .maybeSingle();

    if (error || !visit) {
      return htmlOrJson(req, false, "Not found", { error: "Visit request not found" }, 404);
    }

    if (!visit.action_token || visit.action_token !== token) {
      return htmlOrJson(req, false, "Unauthorized", { error: "Invalid or expired token" }, 401);
    }

    if (
      visit.action_token_expires_at &&
      new Date(visit.action_token_expires_at).getTime() < Date.now()
    ) {
      return htmlOrJson(req, false, "Expired", { error: "Action token expired" }, 401);
    }

    const statusMap: Record<Action, string> = {
      approve: "APPROVED",
      reject: "REJECTED",
      reschedule: "RESCHEDULED",
    };

    const update: Record<string, unknown> = {
      status: statusMap[action],
      ceo_response_at: new Date().toISOString(),
      ceo_notes: payload.notes ?? null,
    };

    if (action === "approve") {
      update.approved_visit_at =
        payload.approved_visit_at || new Date().toISOString();
    }

    if (action === "reschedule" && payload.proposed_times?.length) {
      update.proposed_times = payload.proposed_times;
    }

    // Invalidate token after use
    update.action_token = null;
    update.action_token_expires_at = null;

    const { error: updErr } = await supabase
      .from("opa_ceo_visit_requests")
      .update(update)
      .eq("id", requestId);

    if (updErr) {
      return htmlOrJson(req, false, "Update failed", { error: "Failed to update visit request" }, 500);
    }

    return htmlOrJson(
      req,
      true,
      `Visit ${action}d`,
      { ok: true, request_id: requestId, status: statusMap[action] },
      200,
      `<h1>Visit ${action}d</h1><p>Your response has been recorded. You can close this page.</p>`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function wantsHtml(req: Request): boolean {
  const accept = req.headers.get("accept") || "";
  const ct = req.headers.get("content-type") || "";
  return accept.includes("text/html") || ct.includes("application/x-www-form-urlencoded") ||
    ct.includes("multipart/form-data");
}

function htmlOrJson(
  req: Request,
  ok: boolean,
  title: string,
  json: Record<string, unknown>,
  status: number,
  htmlBody?: string,
): Response {
  if (wantsHtml(req) || req.method === "GET") {
    return htmlPage(
      title,
      htmlBody || `<h1>${title}</h1><p>${String(json.error || title)}</p>`,
      ok,
    );
  }
  return new Response(JSON.stringify(json), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
