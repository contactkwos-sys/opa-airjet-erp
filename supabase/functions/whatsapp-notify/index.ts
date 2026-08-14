// Supabase Edge Function: whatsapp-notify
// Sends CEO visit approval WhatsApp messages with approve/reject/reschedule links.
// Secrets (never logged): WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID, CEO_WHATSAPP_NUMBER

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type VisitPayload = {
  request_id: string;
  visitor_name?: string;
  visitor_company?: string;
  purpose?: string;
  host_name?: string;
  proposed_visit_at?: string;
  proposed_times?: string[];
  action_base_url?: string;
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildActionLinks(
  baseUrl: string,
  requestId: string,
  token: string,
): { approve: string; reject: string; reschedule: string } {
  const root = baseUrl.replace(/\/$/, "");
  const q = `request_id=${encodeURIComponent(requestId)}&token=${encodeURIComponent(token)}`;
  return {
    approve: `${root}/approve?${q}`,
    reject: `${root}/reject?${q}`,
    reschedule: `${root}/reschedule?${q}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = requiredEnv("WHATSAPP_API_TOKEN");
    const phoneNumberId = requiredEnv("WHATSAPP_PHONE_NUMBER_ID");
    const ceoNumber = requiredEnv("CEO_WHATSAPP_NUMBER");
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const body = (await req.json()) as VisitPayload;
    if (!body.request_id) {
      return new Response(JSON.stringify({ error: "request_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const actionToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { data: visit, error: visitErr } = await supabase
      .from("opa_ceo_visit_requests")
      .update({
        action_token: actionToken,
        action_token_expires_at: expiresAt,
        status: "PENDING",
      })
      .eq("id", body.request_id)
      .select("*")
      .single();

    if (visitErr || !visit) {
      return new Response(
        JSON.stringify({ error: "Visit request not found", detail: visitErr?.message }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const actionBase =
      body.action_base_url ||
      Deno.env.get("CEO_VISIT_ACTION_BASE_URL") ||
      `${supabaseUrl}/functions/v1/ceo-visit-action`;

    const links = buildActionLinks(actionBase, body.request_id, actionToken);

    const visitorName = body.visitor_name || visit.visitor_name || "Visitor";
    const purpose = body.purpose || visit.purpose || "-";
    const host = body.host_name || visit.host_name || "-";
    const when =
      body.proposed_visit_at ||
      visit.proposed_visit_at ||
      (Array.isArray(body.proposed_times) && body.proposed_times[0]) ||
      "TBD";

    const messageBody = [
      "OPA Group – CEO Visit Approval",
      `Visitor: ${visitorName}`,
      body.visitor_company || visit.visitor_company
        ? `Company: ${body.visitor_company || visit.visitor_company}`
        : null,
      `Host: ${host}`,
      `Purpose: ${purpose}`,
      `Proposed: ${when}`,
      "",
      `Approve: ${links.approve}`,
      `Reject: ${links.reject}`,
      `Reschedule: ${links.reschedule}`,
    ]
      .filter(Boolean)
      .join("\n");

    // Queue outbox row (no secrets stored)
    const { data: outbox, error: outboxErr } = await supabase
      .from("opa_whatsapp_outbox")
      .insert({
        to_number: ceoNumber,
        template_name: "ceo_visit_approval",
        message_body: messageBody,
        payload: {
          request_id: body.request_id,
          links: { approve: links.approve, reject: links.reject, reschedule: links.reschedule },
        },
        status: "SENDING",
        related_module: "ceo_visit",
        related_record_id: body.request_id,
        attempt_count: 1,
      })
      .select("id")
      .single();

    if (outboxErr) {
      return new Response(JSON.stringify({ error: "Failed to queue WhatsApp message" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const waUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
    const waRes = await fetch(waUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: ceoNumber.replace(/\D/g, ""),
        type: "text",
        text: { body: messageBody, preview_url: true },
      }),
    });

    const waJson = await waRes.json().catch(() => ({}));
    // Never log tokens or Authorization headers

    if (!waRes.ok) {
      await supabase
        .from("opa_whatsapp_outbox")
        .update({
          status: "FAILED",
          last_error: `HTTP ${waRes.status}`,
        })
        .eq("id", outbox.id);

      return new Response(
        JSON.stringify({ error: "WhatsApp send failed", status: waRes.status }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const providerMessageId =
      waJson?.messages?.[0]?.id ?? waJson?.message_id ?? null;

    await supabase
      .from("opa_whatsapp_outbox")
      .update({
        status: "SENT",
        provider_message_id: providerMessageId,
        sent_at: new Date().toISOString(),
      })
      .eq("id", outbox.id);

    await supabase
      .from("opa_ceo_visit_requests")
      .update({ whatsapp_message_id: providerMessageId })
      .eq("id", body.request_id);

    return new Response(
      JSON.stringify({
        ok: true,
        request_id: body.request_id,
        outbox_id: outbox.id,
        provider_message_id: providerMessageId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Do not include env values or tokens in error responses beyond names
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
