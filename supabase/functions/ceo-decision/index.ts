import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, sha256 } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const body = await req.json();
    const {
      ceo_request_id,
      decision,
      remarks,
      rescheduled_date,
      rescheduled_time,
      token,
    } = body as {
      ceo_request_id: string;
      decision: "APPROVED" | "REJECTED" | "RESCHEDULED";
      remarks?: string;
      rescheduled_date?: string;
      rescheduled_time?: string;
      token?: string;
    };

    if (!ceo_request_id || !decision) {
      return json({ error: "ceo_request_id and decision required" }, 400, headers);
    }
    if (!["APPROVED", "REJECTED", "RESCHEDULED"].includes(decision)) {
      return json({ error: "Invalid decision" }, 400, headers);
    }
    if (decision === "REJECTED" && !remarks?.trim()) {
      return json({ error: "CEO remarks are mandatory when rejecting" }, 400, headers);
    }
    if (decision === "RESCHEDULED") {
      if (!rescheduled_date || !rescheduled_time) {
        return json({ error: "New date and time are required" }, 400, headers);
      }
      if (!remarks?.trim()) {
        return json({ error: "CEO remarks are mandatory when rescheduling" }, 400, headers);
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const tokenSecret = Deno.env.get("CEO_APPROVAL_TOKEN_SECRET") || "dev-secret";
    const admin = createClient(supabaseUrl, serviceKey);

    // Authenticated user (optional if using token)
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const authUser = userData.user;

    const { data: ceo, error: ceoErr } = await admin
      .from("ceo_visit_requests")
      .select("*")
      .eq("id", ceo_request_id)
      .single();
    if (ceoErr || !ceo) return json({ error: "Request not found" }, 404, headers);

    if (ceo.ceo_decision) {
      return json({ error: "This request has already been decided" }, 409, headers);
    }

    let decisionBy: string | null = authUser?.id ?? null;
    let authorized = false;

    if (token) {
      if (!ceo.approval_token_hash || !ceo.token_expires_at) {
        return json({ error: "Approval token not issued" }, 403, headers);
      }
      if (new Date(ceo.token_expires_at).getTime() < Date.now()) {
        return json({ error: "Approval link has expired" }, 403, headers);
      }
      const hash = await sha256(`${tokenSecret}:${token}:${ceo_request_id}`);
      if (hash !== ceo.approval_token_hash) {
        return json({ error: "Invalid approval token" }, 403, headers);
      }
      authorized = true;
      if (!decisionBy) {
        const { data: ceoProfile } = await admin
          .from("profiles")
          .select("id")
          .eq("role", "CEO")
          .limit(1)
          .maybeSingle();
        decisionBy = ceoProfile?.id ?? null;
      }
    } else if (authUser) {
      const { data: profile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", authUser.id)
        .maybeSingle();
      if (profile && ["CEO", "SUPER_ADMIN", "DIRECTOR"].includes(profile.role)) {
        authorized = true;
        decisionBy = authUser.id;
      }
    }

    if (!authorized) {
      return json({ error: "Unauthorized" }, 403, headers);
    }

    const now = new Date().toISOString();
    const visitorStatus =
      decision === "APPROVED"
        ? "APPROVED"
        : decision === "REJECTED"
          ? "REJECTED"
          : "RESCHEDULED";

    const { data: updated, error: updErr } = await admin
      .from("ceo_visit_requests")
      .update({
        status: visitorStatus,
        ceo_decision: decision,
        ceo_remarks: remarks?.trim() || null,
        decision_by: decisionBy,
        decision_at: now,
        rescheduled_date: rescheduled_date || null,
        rescheduled_time: rescheduled_time || null,
        // invalidate token after use
        approval_token_hash: null,
        token_expires_at: null,
        updated_at: now,
      })
      .eq("id", ceo_request_id)
      .is("ceo_decision", null)
      .select("*")
      .maybeSingle();

    if (updErr) return json({ error: updErr.message }, 500, headers);
    if (!updated) {
      return json({ error: "This request has already been decided" }, 409, headers);
    }

    const visitorUpdate: Record<string, unknown> = {
      status: visitorStatus,
      updated_at: now,
    };
    if (decision === "RESCHEDULED") {
      visitorUpdate.requested_date = rescheduled_date;
      visitorUpdate.requested_time = rescheduled_time;
    }

    await admin
      .from("visitor_requests")
      .update(visitorUpdate)
      .eq("id", ceo.visitor_request_id);

    const action =
      decision === "APPROVED"
        ? "CEO Approved"
        : decision === "REJECTED"
          ? "CEO Rejected"
          : "CEO Rescheduled";

    await admin.from("audit_logs").insert({
      user_id: decisionBy,
      action,
      module: "security",
      record_id: ceo_request_id,
      new_data: updated,
    });

    await admin.from("security_notifications").insert({
      notification_type: `CEO_${decision}`,
      reference_id: ceo_request_id,
      recipient_role: "SECURITY_HEAD",
      message: `CEO ${decision.toLowerCase()} visiting request ${ceo.request_number}`,
      is_read: false,
    });

    return json({ request: updated }, 200, headers);
  } catch (e) {
    return json({ error: String(e) }, 500, headers);
  }
});

function json(body: unknown, status: number, headers: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
