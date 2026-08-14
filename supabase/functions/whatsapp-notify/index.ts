import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  buildCeoMessage,
  corsHeaders,
  randomToken,
  sha256,
} from "../_shared/utils.ts";

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const { ceo_request_id } = await req.json();
    if (!ceo_request_id) {
      return json({ error: "ceo_request_id required" }, 400, headers);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: ceo, error: ceoErr } = await admin
      .from("ceo_visit_requests")
      .select("*, visitor:visitor_requests(*)")
      .eq("id", ceo_request_id)
      .single();
    if (ceoErr || !ceo) {
      return json({ error: "CEO request not found" }, 404, headers);
    }

    const visitor = ceo.visitor;
    if (!visitor) {
      return json({ error: "Visitor request missing" }, 404, headers);
    }

    const whatsappUrl = Deno.env.get("WHATSAPP_API_URL");
    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const ceoWhatsapp = Deno.env.get("CEO_WHATSAPP_NUMBER");
    const tokenSecret = Deno.env.get("CEO_APPROVAL_TOKEN_SECRET") || "dev-secret";
    const appBase =
      Deno.env.get("APP_BASE_URL") || Deno.env.get("VITE_APP_BASE_URL") || "";

    if (!whatsappUrl || !accessToken || !phoneNumberId || !ceoWhatsapp || !appBase) {
      await admin
        .from("ceo_visit_requests")
        .update({ whatsapp_status: "PENDING_CONFIGURATION", updated_at: new Date().toISOString() })
        .eq("id", ceo_request_id);

      return json({
        status: "PENDING_CONFIGURATION",
        message: "WhatsApp Pending Configuration",
      }, 200, headers);
    }

    const rawToken = randomToken(24);
    const tokenHash = await sha256(`${tokenSecret}:${rawToken}:${ceo_request_id}`);
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    await admin
      .from("ceo_visit_requests")
      .update({
        approval_token_hash: tokenHash,
        token_expires_at: expires,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ceo_request_id);

    const base = `${appBase.replace(/\/$/, "")}/ceo-approval/${ceo_request_id}`;
    const approval_link = `${base}?token=${rawToken}&action=APPROVE`;
    const rejection_link = `${base}?token=${rawToken}&action=REJECT`;
    const reschedule_link = `${base}?token=${rawToken}&action=RESCHEDULE`;

    let securityUser = "Security";
    if (visitor.created_by) {
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", visitor.created_by)
        .maybeSingle();
      if (profile?.full_name) securityUser = profile.full_name;
    }

    const bodyText = buildCeoMessage({
      request_id: visitor.request_number,
      visitor_name: visitor.visitor_name,
      company_name: visitor.company_name,
      mobile: visitor.mobile,
      purpose: visitor.purpose,
      date: visitor.requested_date,
      time: visitor.requested_time,
      number_of_visitors: visitor.number_of_visitors,
      security_user: securityUser,
      approval_link,
      rejection_link,
      reschedule_link,
    });

    const endpoint = `${whatsappUrl.replace(/\/$/, "")}/${phoneNumberId}/messages`;
    const waRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: ceoWhatsapp.replace(/\D/g, ""),
        type: "text",
        text: { body: bodyText },
      }),
    });

    if (!waRes.ok) {
      const errText = await waRes.text();
      await admin
        .from("ceo_visit_requests")
        .update({ whatsapp_status: "FAILED", updated_at: new Date().toISOString() })
        .eq("id", ceo_request_id);
      return json({ status: "FAILED", detail: errText }, 200, headers);
    }

    await admin
      .from("ceo_visit_requests")
      .update({ whatsapp_status: "SENT", updated_at: new Date().toISOString() })
      .eq("id", ceo_request_id);

    await admin.from("audit_logs").insert({
      action: "WhatsApp Notification Sent",
      module: "security",
      record_id: ceo_request_id,
      new_data: { to: ceoWhatsapp, request_number: visitor.request_number },
    });

    return json({ status: "SENT" }, 200, headers);
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
