// Supabase Edge Function: pin-login
// Validates a 4-digit role PIN server-side and returns a short-lived session.
// PINs / hashes never leave the database except via bcrypt compare.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type PinBody = {
  role?: string;
  pin?: string;
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function roleSlug(role: string): string {
  return role.toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = (await req.json()) as PinBody;
    const role = String(body.role ?? "").trim().toUpperCase();
    const pin = String(body.pin ?? "").trim();

    if (!role || !/^\d{4}$/.test(pin)) {
      return json(400, { error: "Enter a valid role and 4-digit PIN." });
    }

    const { data: verified, error: verifyError } = await admin.rpc(
      "opa_verify_role_pin",
      { p_role: role, p_pin: pin },
    );

    if (verifyError) {
      console.error("[pin-login] verify failed", verifyError.message);
      return json(500, { error: "PIN verification unavailable." });
    }

    const row = Array.isArray(verified) ? verified[0] : verified;
    if (!row?.ok || !row.auth_email) {
      await admin.from("opa_audit_logs").insert({
        action: "PIN_LOGIN_FAILED",
        module: "auth",
        new_value: { role },
      });
      return json(401, { error: "Invalid PIN." });
    }

    const email = String(row.auth_email);
    const fullName = String(row.full_name ?? role);
    const password = Deno.env.get("OPA_PIN_BOOTSTRAP_SECRET") ??
      `opa-pin-${roleSlug(role)}-${requiredEnv("SUPABASE_SERVICE_ROLE_KEY").slice(0, 24)}`;

    // Ensure auth user exists for this role account.
    let userId: string | null = null;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, full_name: fullName, login_method: "pin" },
    });

    if (created.data.user) {
      userId = created.data.user.id;
    } else {
      // User already exists — rotate password and resolve id via magic link metadata.
      const linked = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      if (linked.error || !linked.data.user) {
        console.error(
          "[pin-login] resolve user",
          created.error?.message,
          linked.error?.message,
        );
        return json(500, { error: "Could not provision role account." });
      }
      userId = linked.data.user.id;
      await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { role, full_name: fullName, login_method: "pin" },
      });
    }

    // Ensure opa_profiles row matches the role.
    const { error: upsertError } = await admin.from("opa_profiles").upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        role,
        is_active: true,
        employee_id: `PIN-${role}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (upsertError) {
      console.error("[pin-login] profile upsert", upsertError.message);
      return json(500, { error: "Could not load role profile." });
    }

    const { data: sessionData, error: signInError } = await admin.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !sessionData.session) {
      console.error("[pin-login] signIn", signInError?.message);
      return json(500, { error: "Could not start session." });
    }

    await admin.from("opa_audit_logs").insert({
      user_id: userId,
      user_name: fullName,
      action: "PIN_LOGIN",
      module: "auth",
      new_value: { role, method: "pin" },
    });

    return json(200, {
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_in: sessionData.session.expires_in,
        expires_at: sessionData.session.expires_at,
        token_type: sessionData.session.token_type,
      },
      user: {
        id: userId,
        email,
        role,
        full_name: fullName,
      },
    });
  } catch (err) {
    console.error("[pin-login]", err instanceof Error ? err.message : err);
    return json(500, { error: "PIN login failed." });
  }
});
