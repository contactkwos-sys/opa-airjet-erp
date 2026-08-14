/**
 * Local-mode smoke test for Security visitor → CEO → check-in → checkout flow.
 * Run: npx tsx scripts/security-smoke.mts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Minimal browser stubs for localStore
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k) => mem.get(k) ?? null,
  setItem: (k, v) => {
    mem.set(k, String(v));
  },
  removeItem: (k) => {
    mem.delete(k);
  },
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

(globalThis as unknown as { window: { dispatchEvent: (e: Event) => boolean; addEventListener: () => void; removeEventListener: () => void } }).window = {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};

(globalThis as unknown as { CustomEvent: typeof CustomEvent }).CustomEvent = class CustomEvent extends Event {
  detail: unknown;
  constructor(type: string, init?: CustomEventInit) {
    super(type, init);
    this.detail = init?.detail;
  }
} as typeof CustomEvent;

async function main() {
  // Dynamic import after stubs
  const { isValidIndianMobile, normalizeIndianMobile, validateVisitorForm } = await import(
    "../src/lib/validators.ts"
  );
  const svc = await import("../src/services/securityService.ts");

  console.assert(isValidIndianMobile("9876543210"), "valid mobile");
  console.assert(!isValidIndianMobile("12345"), "invalid mobile");
  console.assert(normalizeIndianMobile("+91 98765-43210") === "9876543210", "normalize");

  const errs = validateVisitorForm({
    visitor_name: "",
    company_name: "ACME",
    mobile: "123",
    purpose: "Meet",
    person_to_meet: "CEO",
    requested_date: "2026-08-14",
    requested_time: "10:00",
    number_of_visitors: 1,
  });
  console.assert(errs.length >= 2, "validation errors");

  const user = {
    id: "u1",
    email: "guard@test",
    full_name: "Guard One",
    role: "SECURITY_HEAD" as const,
    created_at: new Date().toISOString(),
  };

  const created = await svc.createVisitorRequest(
    {
      visitor_name: "Ravi Kumar",
      company_name: "Textile Traders",
      mobile: "9876543210",
      purpose: "CEO discussion",
      person_to_meet: "CEO",
      requested_date: "2026-08-14",
      requested_time: "11:00",
      number_of_visitors: 2,
      requestCeoMeeting: true,
    },
    user
  );
  console.assert(created.visitor.status === "PENDING_CEO_APPROVAL", "ceo pending");
  console.assert(created.whatsappStatus === "PENDING_CONFIGURATION", "wa pending");
  console.assert(created.ceo, "ceo row");

  try {
    await svc.createVisitorRequest(
      {
        visitor_name: "Dup",
        company_name: "X",
        mobile: "9876543210",
        purpose: "x",
        person_to_meet: "HR",
        requested_date: "2026-08-14",
        requested_time: "12:00",
        number_of_visitors: 1,
      },
      user
    );
    throw new Error("duplicate should fail");
  } catch (e) {
    console.assert(String(e).includes("Duplicate"), "duplicate blocked");
  }

  const ceoUser = { ...user, id: "ceo1", role: "CEO" as const, full_name: "CEO" };
  await svc.decideCeoRequest({
    ceoRequestId: created.ceo!.id,
    decision: "APPROVED",
    decisionBy: ceoUser,
    remarks: "OK",
  });

  try {
    await svc.decideCeoRequest({
      ceoRequestId: created.ceo!.id,
      decision: "APPROVED",
      decisionBy: ceoUser,
    });
    throw new Error("double approve should fail");
  } catch (e) {
    console.assert(String(e).includes("already"), "no duplicate decision");
  }

  const entry = await svc.checkInVisitor({
    visitorRequestId: created.visitor.id,
    user,
    id_verified: true,
    number_of_persons: 2,
  });
  console.assert(entry.gate_pass_number.startsWith("GP-"), "gate pass");

  const out = await svc.checkOutVisitor({ entryId: entry.id, user });
  console.assert(out.status === "EXITED", "exited");
  console.assert(Boolean(out.visit_duration), "duration");

  const stats = await svc.getDashboardStats();
  console.assert(stats.exited >= 1 || stats.totalVisitorsToday >= 1, "stats");

  // ensure source files exist
  for (const f of [
    "supabase/migrations/20260814000000_security_visitor_module.sql",
    "supabase/functions/whatsapp-notify/index.ts",
    "supabase/functions/ceo-decision/index.ts",
  ]) {
    readFileSync(resolve(process.cwd(), f));
  }

  console.log("SECURITY SMOKE OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
