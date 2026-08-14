import type {
  CeoDecision,
  CeoVisitRequest,
  MaterialGateEntry,
  PersonToMeet,
  Profile,
  SecurityDashboardStats,
  SecurityIncident,
  SecurityNotification,
  VehicleEntry,
  VisitorEntry,
  VisitorRequest,
  VisitorStatus,
} from "../types/security";
import { writeAudit, pushNotification } from "../lib/audit";
import {
  nowISO,
  readStore,
  seqNumber,
  todayISO,
  uid,
  updateStore,
} from "../lib/localStore";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { normalizeIndianMobile } from "../lib/validators";

export type CreateVisitorInput = {
  visitor_name: string;
  company_name: string;
  mobile: string;
  email?: string;
  purpose: string;
  person_to_meet: PersonToMeet;
  department?: string;
  requested_date: string;
  requested_time: string;
  number_of_visitors: number;
  vehicle_number?: string;
  vehicle_type?: string;
  id_proof_type?: string;
  id_proof_number?: string;
  visitor_photo_url?: string;
  security_remarks?: string;
  requestCeoMeeting?: boolean;
};

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfToday(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export async function getDashboardStats(): Promise<SecurityDashboardStats> {
  if (isSupabaseConfigured && supabase) {
    const today = todayISO();
    const [
      visitorsToday,
      pending,
      ceoPending,
      approved,
      rejected,
      inside,
      exited,
      vehicles,
      inward,
      outward,
      gatePasses,
      incidents,
      critical,
    ] = await Promise.all([
      supabase
        .from("visitor_requests")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfToday())
        .lte("created_at", endOfToday()),
      supabase
        .from("visitor_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["PENDING", "PENDING_CEO_APPROVAL"]),
      supabase
        .from("ceo_visit_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "PENDING_CEO_APPROVAL"),
      supabase
        .from("visitor_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "APPROVED")
        .eq("requested_date", today),
      supabase
        .from("visitor_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "REJECTED")
        .eq("requested_date", today),
      supabase
        .from("visitor_entries")
        .select("id", { count: "exact", head: true })
        .eq("status", "INSIDE"),
      supabase
        .from("visitor_entries")
        .select("id", { count: "exact", head: true })
        .eq("status", "EXITED")
        .gte("exit_time", startOfToday()),
      supabase
        .from("vehicle_entries")
        .select("id", { count: "exact", head: true })
        .eq("status", "INSIDE"),
      supabase
        .from("material_gate_entries")
        .select("id", { count: "exact", head: true })
        .eq("entry_type", "INWARD")
        .gte("created_at", startOfToday()),
      supabase
        .from("material_gate_entries")
        .select("id", { count: "exact", head: true })
        .eq("entry_type", "OUTWARD")
        .gte("created_at", startOfToday()),
      supabase
        .from("visitor_entries")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfToday()),
      supabase
        .from("security_incidents")
        .select("id", { count: "exact", head: true })
        .neq("status", "CLOSED"),
      supabase
        .from("security_incidents")
        .select("id", { count: "exact", head: true })
        .in("severity", ["HIGH", "CRITICAL"])
        .neq("status", "CLOSED"),
    ]);

    const securityAlerts = critical.count ?? 0;
    return {
      totalVisitorsToday: visitorsToday.count ?? 0,
      pendingRequests: pending.count ?? 0,
      ceoRequests: ceoPending.count ?? 0,
      approved: approved.count ?? 0,
      rejected: rejected.count ?? 0,
      insideFactory: inside.count ?? 0,
      exited: exited.count ?? 0,
      vehicles: vehicles.count ?? 0,
      materialInward: inward.count ?? 0,
      materialOutward: outward.count ?? 0,
      gatePassesIssued: gatePasses.count ?? 0,
      securityIncidents: incidents.count ?? 0,
      emergencyAlerts: securityAlerts,
      securityAlerts,
    };
  }

  const s = readStore();
  const today = todayISO();
  return {
    totalVisitorsToday: s.visitor_requests.filter((v) => v.created_at.slice(0, 10) === today).length,
    pendingRequests: s.visitor_requests.filter((v) =>
      ["PENDING", "PENDING_CEO_APPROVAL"].includes(v.status)
    ).length,
    ceoRequests: s.ceo_visit_requests.filter((c) => c.status === "PENDING_CEO_APPROVAL").length,
    approved: s.visitor_requests.filter(
      (v) => v.status === "APPROVED" && v.requested_date === today
    ).length,
    rejected: s.visitor_requests.filter(
      (v) => v.status === "REJECTED" && v.requested_date === today
    ).length,
    insideFactory: s.visitor_entries.filter((e) => e.status === "INSIDE").length,
    exited: s.visitor_entries.filter(
      (e) => e.status === "EXITED" && e.exit_time?.slice(0, 10) === today
    ).length,
    vehicles: s.vehicle_entries.filter((v) => v.status === "INSIDE").length,
    materialInward: s.material_gate_entries.filter(
      (m) => m.entry_type === "INWARD" && m.created_at.slice(0, 10) === today
    ).length,
    materialOutward: s.material_gate_entries.filter(
      (m) => m.entry_type === "OUTWARD" && m.created_at.slice(0, 10) === today
    ).length,
    gatePassesIssued: s.visitor_entries.filter((e) => e.created_at.slice(0, 10) === today)
      .length,
    securityIncidents: s.security_incidents.filter((i) => i.status !== "CLOSED").length,
    emergencyAlerts: s.security_incidents.filter(
      (i) => ["HIGH", "CRITICAL"].includes(i.severity) && i.status !== "CLOSED"
    ).length,
    securityAlerts: s.security_incidents.filter(
      (i) => ["HIGH", "CRITICAL"].includes(i.severity) && i.status !== "CLOSED"
    ).length,
  };
}

export async function listVisitorRequests(): Promise<VisitorRequest[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("visitor_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as VisitorRequest[];
  }
  return readStore().visitor_requests;
}

export async function findDuplicateVisitor(mobile: string, date: string): Promise<VisitorRequest | null> {
  const normalized = normalizeIndianMobile(mobile);
  const list = await listVisitorRequests();
  return (
    list.find(
      (v) =>
        normalizeIndianMobile(v.mobile) === normalized &&
        v.requested_date === date &&
        !["CANCELLED", "REJECTED", "EXITED", "COMPLETED"].includes(v.status)
    ) ?? null
  );
}

export async function createVisitorRequest(
  input: CreateVisitorInput,
  user: Profile
): Promise<{
  visitor: VisitorRequest;
  ceo?: CeoVisitRequest;
  whatsappStatus: "PENDING_CONFIGURATION" | "SENT" | "FAILED" | "SKIPPED";
}> {
  const mobile = normalizeIndianMobile(input.mobile);
  const dup = await findDuplicateVisitor(mobile, input.requested_date);
  if (dup) {
    throw new Error(
      `Duplicate visiting request exists (${dup.request_number}) for this mobile on ${input.requested_date}`
    );
  }

  const requestCeo =
    Boolean(input.requestCeoMeeting) || input.person_to_meet === "CEO";
  const status: VisitorStatus = requestCeo ? "PENDING_CEO_APPROVAL" : "PENDING";

  if (isSupabaseConfigured && supabase) {
    const request_number = await nextRequestNumber("VR");
    const { data: visitor, error } = await supabase
      .from("visitor_requests")
      .insert({
        request_number,
        visitor_name: input.visitor_name.trim(),
        company_name: input.company_name.trim(),
        mobile,
        email: input.email?.trim() || null,
        purpose: input.purpose.trim(),
        person_to_meet: input.person_to_meet,
        department: input.department?.trim() || null,
        requested_date: input.requested_date,
        requested_time: input.requested_time,
        number_of_visitors: input.number_of_visitors,
        vehicle_number: input.vehicle_number?.trim() || null,
        vehicle_type: input.vehicle_type?.trim() || null,
        id_proof_type: input.id_proof_type?.trim() || null,
        id_proof_number: input.id_proof_number?.trim() || null,
        visitor_photo_url: input.visitor_photo_url || null,
        security_remarks: input.security_remarks?.trim() || null,
        status,
        created_by: user.id,
      })
      .select("*")
      .single();
    if (error) throw error;

    await writeAudit({
      user,
      action: "Visitor Created",
      module: "security",
      recordId: visitor.id,
      newData: visitor,
    });

    let ceo: CeoVisitRequest | undefined;
    let whatsappStatus: "PENDING_CONFIGURATION" | "SENT" | "FAILED" | "SKIPPED" =
      "SKIPPED";

    if (requestCeo) {
      const { data: ceoRow, error: ceoErr } = await supabase
        .from("ceo_visit_requests")
        .insert({
          visitor_request_id: visitor.id,
          request_number: visitor.request_number,
          status: "PENDING_CEO_APPROVAL",
          whatsapp_status: "PENDING_CONFIGURATION",
        })
        .select("*")
        .single();
      if (ceoErr) throw ceoErr;
      ceo = ceoRow as CeoVisitRequest;

      await writeAudit({
        user,
        action: "CEO Request Created",
        module: "security",
        recordId: ceo.id,
        newData: ceo,
      });
      await pushNotification({
        notification_type: "CEO_VISIT_REQUEST",
        reference_id: ceo.id,
        recipient_role: "CEO",
        message: `New CEO visiting request ${visitor.request_number} from ${visitor.visitor_name}`,
      });

      whatsappStatus = await triggerWhatsAppNotify(ceo.id);
      await supabase
        .from("ceo_visit_requests")
        .update({ whatsapp_status: whatsappStatus, updated_at: nowISO() })
        .eq("id", ceo.id);
      ceo = { ...ceo, whatsapp_status: whatsappStatus };
    }

    return { visitor: visitor as VisitorRequest, ceo, whatsappStatus };
  }

  // Local mode
  let created!: VisitorRequest;
  let ceoLocal: CeoVisitRequest | undefined;
  let whatsappStatus: "PENDING_CONFIGURATION" | "SENT" | "FAILED" | "SKIPPED" =
    "PENDING_CONFIGURATION";

  updateStore((s) => {
    const request_number = seqNumber("VR", s.visitor_requests.length);
    created = {
      id: uid("vr"),
      request_number,
      visitor_name: input.visitor_name.trim(),
      company_name: input.company_name.trim(),
      mobile,
      email: input.email?.trim() || null,
      purpose: input.purpose.trim(),
      person_to_meet: input.person_to_meet,
      department: input.department?.trim() || null,
      requested_date: input.requested_date,
      requested_time: input.requested_time,
      number_of_visitors: input.number_of_visitors,
      vehicle_number: input.vehicle_number?.trim() || null,
      vehicle_type: input.vehicle_type?.trim() || null,
      id_proof_type: input.id_proof_type?.trim() || null,
      id_proof_number: input.id_proof_number?.trim() || null,
      visitor_photo_url: input.visitor_photo_url || null,
      security_remarks: input.security_remarks?.trim() || null,
      status,
      created_by: user.id,
      created_by_name: user.full_name,
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    s.visitor_requests.unshift(created);

    if (requestCeo) {
      ceoLocal = {
        id: uid("ceo"),
        visitor_request_id: created.id,
        request_number: created.request_number,
        status: "PENDING_CEO_APPROVAL",
        ceo_decision: null,
        ceo_remarks: null,
        decision_by: null,
        decision_at: null,
        rescheduled_date: null,
        rescheduled_time: null,
        approval_token_hash: null,
        token_expires_at: null,
        whatsapp_status: "PENDING_CONFIGURATION",
        created_at: nowISO(),
        updated_at: nowISO(),
      };
      s.ceo_visit_requests.unshift(ceoLocal);
      s.security_notifications.unshift({
        id: uid("ntf"),
        notification_type: "CEO_VISIT_REQUEST",
        reference_id: ceoLocal.id,
        recipient_role: "CEO",
        recipient_user_id: null,
        message: `New CEO visiting request ${created.request_number} from ${created.visitor_name}`,
        is_read: false,
        created_at: nowISO(),
      });
      s.audit_logs.unshift(
        {
          id: uid("aud"),
          user_id: user.id,
          action: "Visitor Created",
          module: "security",
          record_id: created.id,
          old_data: null,
          new_data: created,
          ip_address: null,
          created_at: nowISO(),
        },
        {
          id: uid("aud"),
          user_id: user.id,
          action: "CEO Request Created",
          module: "security",
          record_id: ceoLocal.id,
          old_data: null,
          new_data: ceoLocal,
          ip_address: null,
          created_at: nowISO(),
        }
      );
    } else {
      s.audit_logs.unshift({
        id: uid("aud"),
        user_id: user.id,
        action: "Visitor Created",
        module: "security",
        record_id: created.id,
        old_data: null,
        new_data: created,
        ip_address: null,
        created_at: nowISO(),
      });
    }
  });

  return { visitor: created, ceo: ceoLocal, whatsappStatus };
}

async function nextRequestNumber(prefix: string): Promise<string> {
  if (!supabase) return seqNumber(prefix, 0);
  const today = todayISO().replace(/-/g, "");
  const { count } = await supabase
    .from("visitor_requests")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOfToday());
  return `${prefix}-${today}-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

async function triggerWhatsAppNotify(
  ceoRequestId: string
): Promise<"PENDING_CONFIGURATION" | "SENT" | "FAILED" | "SKIPPED"> {
  if (!supabase) return "PENDING_CONFIGURATION";
  try {
    const { data, error } = await supabase.functions.invoke("whatsapp-notify", {
      body: { ceo_request_id: ceoRequestId },
    });
    if (error) return "PENDING_CONFIGURATION";
    const status = (data as { status?: string } | null)?.status;
    if (status === "SENT") return "SENT";
    if (status === "FAILED") return "FAILED";
    return "PENDING_CONFIGURATION";
  } catch {
    return "PENDING_CONFIGURATION";
  }
}

export async function listCeoRequests(): Promise<CeoVisitRequest[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("ceo_visit_requests")
      .select("*, visitor:visitor_requests(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as CeoVisitRequest[];
  }
  const s = readStore();
  return s.ceo_visit_requests.map((c) => ({
    ...c,
    visitor: s.visitor_requests.find((v) => v.id === c.visitor_request_id),
  }));
}

export async function decideCeoRequest(params: {
  ceoRequestId: string;
  decision: Exclude<CeoDecision, null>;
  remarks?: string;
  rescheduled_date?: string;
  rescheduled_time?: string;
  decisionBy: Profile;
  token?: string;
}): Promise<CeoVisitRequest> {
  if (params.decision === "REJECTED" && !params.remarks?.trim()) {
    throw new Error("CEO remarks are mandatory when rejecting");
  }
  if (params.decision === "RESCHEDULED") {
    if (!params.rescheduled_date || !params.rescheduled_time) {
      throw new Error("New date and time are required for reschedule");
    }
    if (!params.remarks?.trim()) {
      throw new Error("CEO remarks are mandatory when rescheduling");
    }
  }

  if (isSupabaseConfigured && supabase) {
    // Prefer edge function for token-based / atomic decision
    const { data, error } = await supabase.functions.invoke("ceo-decision", {
      body: {
        ceo_request_id: params.ceoRequestId,
        decision: params.decision,
        remarks: params.remarks,
        rescheduled_date: params.rescheduled_date,
        rescheduled_time: params.rescheduled_time,
        token: params.token,
      },
    });
    if (error) throw error;
    if ((data as { error?: string })?.error) {
      throw new Error((data as { error: string }).error);
    }
    return (data as { request: CeoVisitRequest }).request;
  }

  let updated!: CeoVisitRequest;
  updateStore((s) => {
    const idx = s.ceo_visit_requests.findIndex((c) => c.id === params.ceoRequestId);
    if (idx < 0) throw new Error("CEO request not found");
    const current = s.ceo_visit_requests[idx];
    if (current.ceo_decision) {
      throw new Error("This request has already been decided");
    }
    if (current.status !== "PENDING_CEO_APPROVAL" && current.status !== "PENDING") {
      throw new Error("Request is not awaiting CEO decision");
    }

    const visitorStatus: VisitorStatus =
      params.decision === "APPROVED"
        ? "APPROVED"
        : params.decision === "REJECTED"
          ? "REJECTED"
          : "RESCHEDULED";

    updated = {
      ...current,
      status: visitorStatus,
      ceo_decision: params.decision,
      ceo_remarks: params.remarks?.trim() || null,
      decision_by: params.decisionBy.id,
      decision_at: nowISO(),
      rescheduled_date: params.rescheduled_date || null,
      rescheduled_time: params.rescheduled_time || null,
      updated_at: nowISO(),
    };
    s.ceo_visit_requests[idx] = updated;

    const vIdx = s.visitor_requests.findIndex((v) => v.id === current.visitor_request_id);
    if (vIdx >= 0) {
      const visitor = s.visitor_requests[vIdx];
      s.visitor_requests[vIdx] = {
        ...visitor,
        status: visitorStatus,
        requested_date: params.rescheduled_date || visitor.requested_date,
        requested_time: params.rescheduled_time || visitor.requested_time,
        updated_at: nowISO(),
      };
    }

    const action =
      params.decision === "APPROVED"
        ? "CEO Approved"
        : params.decision === "REJECTED"
          ? "CEO Rejected"
          : "CEO Rescheduled";

    s.audit_logs.unshift({
      id: uid("aud"),
      user_id: params.decisionBy.id,
      action,
      module: "security",
      record_id: updated.id,
      old_data: current,
      new_data: updated,
      ip_address: null,
      created_at: nowISO(),
    });

    s.security_notifications.unshift({
      id: uid("ntf"),
      notification_type: `CEO_${params.decision}`,
      reference_id: updated.id,
      recipient_role: "SECURITY_HEAD",
      recipient_user_id: null,
      message: `CEO ${params.decision.toLowerCase()} visiting request ${updated.request_number}`,
      is_read: false,
      created_at: nowISO(),
    });
  });

  return updated;
}

export async function searchApprovedVisitor(query: string): Promise<VisitorRequest[]> {
  const q = query.trim().toLowerCase();
  const list = await listVisitorRequests();
  return list.filter(
    (v) =>
      ["APPROVED", "RESCHEDULED"].includes(v.status) &&
      (v.request_number.toLowerCase().includes(q) ||
        normalizeIndianMobile(v.mobile).includes(normalizeIndianMobile(q)) ||
        v.visitor_name.toLowerCase().includes(q))
  );
}

export async function checkInVisitor(params: {
  visitorRequestId: string;
  user: Profile;
  visitor_photo_url?: string;
  id_verified: boolean;
  actual_vehicle_number?: string;
  number_of_persons: number;
  remarks?: string;
}): Promise<VisitorEntry> {
  if (!params.id_verified) throw new Error("ID verification is required before check-in");

  if (isSupabaseConfigured && supabase) {
    const { data: existing } = await supabase
      .from("visitor_entries")
      .select("id")
      .eq("visitor_request_id", params.visitorRequestId)
      .eq("status", "INSIDE")
      .maybeSingle();
    if (existing) throw new Error("Visitor already checked in");

    const gate_pass_number = await nextGatePassNumber();
    const { data, error } = await supabase
      .from("visitor_entries")
      .insert({
        visitor_request_id: params.visitorRequestId,
        gate_pass_number,
        actual_arrival_time: nowISO(),
        check_in_by: params.user.id,
        visitor_photo_url: params.visitor_photo_url || null,
        id_verified: true,
        actual_vehicle_number: params.actual_vehicle_number || null,
        number_of_persons: params.number_of_persons,
        status: "INSIDE",
        remarks: params.remarks || null,
      })
      .select("*")
      .single();
    if (error) throw error;

    await supabase
      .from("visitor_requests")
      .update({ status: "CHECKED_IN", updated_at: nowISO() })
      .eq("id", params.visitorRequestId);

    await writeAudit({
      user: params.user,
      action: "Visitor Checked In",
      module: "security",
      recordId: data.id,
      newData: data,
    });
    await writeAudit({
      user: params.user,
      action: "Gate Pass Generated",
      module: "security",
      recordId: data.id,
      newData: { gate_pass_number },
    });

    const { data: visitor } = await supabase
      .from("visitor_requests")
      .select("*")
      .eq("id", params.visitorRequestId)
      .single();

    if (visitor) {
      await pushNotification({
        notification_type: "VISITOR_CHECKED_IN",
        reference_id: data.id,
        recipient_role: visitor.person_to_meet,
        message: `${visitor.visitor_name} checked in to meet ${visitor.person_to_meet}`,
      });
    }

    return data as VisitorEntry;
  }

  let entry!: VisitorEntry;
  updateStore((s) => {
    const visitor = s.visitor_requests.find((v) => v.id === params.visitorRequestId);
    if (!visitor) throw new Error("Visitor request not found");
    if (!["APPROVED", "RESCHEDULED"].includes(visitor.status)) {
      throw new Error("Only approved visitors can check in");
    }
    if (s.visitor_entries.some((e) => e.visitor_request_id === visitor.id && e.status === "INSIDE")) {
      throw new Error("Visitor already checked in");
    }
    if (s.visitor_entries.some((e) => e.visitor_request_id === visitor.id && e.gate_pass_number)) {
      // allow only one gate pass per request
    }
    const gate_pass_number = seqNumber("GP", s.visitor_entries.length);
    entry = {
      id: uid("ve"),
      visitor_request_id: visitor.id,
      gate_pass_number,
      actual_arrival_time: nowISO(),
      check_in_by: params.user.id,
      check_in_by_name: params.user.full_name,
      visitor_photo_url: params.visitor_photo_url || visitor.visitor_photo_url,
      id_verified: true,
      actual_vehicle_number: params.actual_vehicle_number || visitor.vehicle_number,
      number_of_persons: params.number_of_persons,
      status: "INSIDE",
      exit_time: null,
      check_out_by: null,
      visit_duration: null,
      remarks: params.remarks || null,
      created_at: nowISO(),
      updated_at: nowISO(),
      visitor,
    };
    s.visitor_entries.unshift(entry);
    const vIdx = s.visitor_requests.findIndex((v) => v.id === visitor.id);
    s.visitor_requests[vIdx] = { ...visitor, status: "CHECKED_IN", updated_at: nowISO() };
    s.audit_logs.unshift(
      {
        id: uid("aud"),
        user_id: params.user.id,
        action: "Visitor Checked In",
        module: "security",
        record_id: entry.id,
        old_data: null,
        new_data: entry,
        ip_address: null,
        created_at: nowISO(),
      },
      {
        id: uid("aud"),
        user_id: params.user.id,
        action: "Gate Pass Generated",
        module: "security",
        record_id: entry.id,
        old_data: null,
        new_data: { gate_pass_number },
        ip_address: null,
        created_at: nowISO(),
      }
    );
    s.security_notifications.unshift({
      id: uid("ntf"),
      notification_type: "VISITOR_CHECKED_IN",
      reference_id: entry.id,
      recipient_role: visitor.person_to_meet,
      recipient_user_id: null,
      message: `${visitor.visitor_name} checked in to meet ${visitor.person_to_meet}`,
      is_read: false,
      created_at: nowISO(),
    });
  });
  return entry;
}

async function nextGatePassNumber(): Promise<string> {
  if (!supabase) return seqNumber("GP", 0);
  const { count } = await supabase
    .from("visitor_entries")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOfToday());
  const today = todayISO().replace(/-/g, "");
  return `GP-${today}-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

export async function listInsideVisitors(): Promise<VisitorEntry[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("visitor_entries")
      .select("*, visitor:visitor_requests(*)")
      .eq("status", "INSIDE")
      .order("actual_arrival_time", { ascending: false });
    if (error) throw error;
    return (data ?? []) as VisitorEntry[];
  }
  const s = readStore();
  return s.visitor_entries
    .filter((e) => e.status === "INSIDE")
    .map((e) => ({
      ...e,
      visitor: s.visitor_requests.find((v) => v.id === e.visitor_request_id),
    }));
}

export async function listVisitorEntries(): Promise<VisitorEntry[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("visitor_entries")
      .select("*, visitor:visitor_requests(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as VisitorEntry[];
  }
  const s = readStore();
  return s.visitor_entries.map((e) => ({
    ...e,
    visitor: s.visitor_requests.find((v) => v.id === e.visitor_request_id),
  }));
}

function formatDuration(ms: number): string {
  const totalMins = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h}h ${m}m`;
}

export async function checkOutVisitor(params: {
  entryId: string;
  user: Profile;
  remarks?: string;
}): Promise<VisitorEntry> {
  if (isSupabaseConfigured && supabase) {
    const { data: current, error: fetchErr } = await supabase
      .from("visitor_entries")
      .select("*")
      .eq("id", params.entryId)
      .single();
    if (fetchErr) throw fetchErr;
    if (current.status !== "INSIDE") throw new Error("Visitor is not inside");

    const exit_time = nowISO();
    const visit_duration = formatDuration(
      new Date(exit_time).getTime() - new Date(current.actual_arrival_time).getTime()
    );

    const { data, error } = await supabase
      .from("visitor_entries")
      .update({
        status: "EXITED",
        exit_time,
        check_out_by: params.user.id,
        visit_duration,
        remarks: params.remarks || current.remarks,
        updated_at: exit_time,
      })
      .eq("id", params.entryId)
      .select("*")
      .single();
    if (error) throw error;

    await supabase
      .from("visitor_requests")
      .update({ status: "EXITED", updated_at: exit_time })
      .eq("id", current.visitor_request_id);

    await writeAudit({
      user: params.user,
      action: "Visitor Checked Out",
      module: "security",
      recordId: data.id,
      oldData: current,
      newData: data,
    });

    return data as VisitorEntry;
  }

  let updated!: VisitorEntry;
  updateStore((s) => {
    const idx = s.visitor_entries.findIndex((e) => e.id === params.entryId);
    if (idx < 0) throw new Error("Entry not found");
    const current = s.visitor_entries[idx];
    if (current.status !== "INSIDE") throw new Error("Visitor is not inside");
    const exit_time = nowISO();
    updated = {
      ...current,
      status: "EXITED",
      exit_time,
      check_out_by: params.user.id,
      check_out_by_name: params.user.full_name,
      visit_duration: formatDuration(
        new Date(exit_time).getTime() - new Date(current.actual_arrival_time).getTime()
      ),
      remarks: params.remarks || current.remarks,
      updated_at: exit_time,
    };
    s.visitor_entries[idx] = updated;
    const vIdx = s.visitor_requests.findIndex((v) => v.id === current.visitor_request_id);
    if (vIdx >= 0) {
      s.visitor_requests[vIdx] = {
        ...s.visitor_requests[vIdx],
        status: "EXITED",
        updated_at: exit_time,
      };
    }
    s.audit_logs.unshift({
      id: uid("aud"),
      user_id: params.user.id,
      action: "Visitor Checked Out",
      module: "security",
      record_id: updated.id,
      old_data: current,
      new_data: updated,
      ip_address: null,
      created_at: nowISO(),
    });
  });
  return updated;
}

export async function listIncidents(): Promise<SecurityIncident[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("security_incidents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as SecurityIncident[];
  }
  return readStore().security_incidents;
}

export async function createIncident(
  input: Omit<SecurityIncident, "id" | "incident_number" | "created_at" | "updated_at">,
  user: Profile
): Promise<SecurityIncident> {
  if (isSupabaseConfigured && supabase) {
    const today = todayISO().replace(/-/g, "");
    const { count } = await supabase
      .from("security_incidents")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfToday());
    const incident_number = `SI-${today}-${String((count ?? 0) + 1).padStart(4, "0")}`;
    const { data, error } = await supabase
      .from("security_incidents")
      .insert({ ...input, incident_number })
      .select("*")
      .single();
    if (error) throw error;
    await writeAudit({
      user,
      action: "Incident Created",
      module: "security",
      recordId: data.id,
      newData: data,
    });
    return data as SecurityIncident;
  }

  let row!: SecurityIncident;
  updateStore((s) => {
    row = {
      ...input,
      id: uid("si"),
      incident_number: seqNumber("SI", s.security_incidents.length),
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    s.security_incidents.unshift(row);
    s.audit_logs.unshift({
      id: uid("aud"),
      user_id: user.id,
      action: "Incident Created",
      module: "security",
      record_id: row.id,
      old_data: null,
      new_data: row,
      ip_address: null,
      created_at: nowISO(),
    });
  });
  return row;
}

export async function closeIncident(id: string, user: Profile): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("security_incidents")
      .update({ status: "CLOSED", updated_at: nowISO() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    await writeAudit({
      user,
      action: "Incident Closed",
      module: "security",
      recordId: id,
      newData: data,
    });
    return;
  }
  updateStore((s) => {
    const idx = s.security_incidents.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const old = s.security_incidents[idx];
    s.security_incidents[idx] = { ...old, status: "CLOSED", updated_at: nowISO() };
    s.audit_logs.unshift({
      id: uid("aud"),
      user_id: user.id,
      action: "Incident Closed",
      module: "security",
      record_id: id,
      old_data: old,
      new_data: s.security_incidents[idx],
      ip_address: null,
      created_at: nowISO(),
    });
  });
}

export async function listVehicles(): Promise<VehicleEntry[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("vehicle_entries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as VehicleEntry[];
  }
  return readStore().vehicle_entries;
}

export async function createVehicleEntry(
  input: Omit<VehicleEntry, "id" | "created_at" | "exit_time" | "status"> & {
    status?: VehicleEntry["status"];
  },
  user: Profile
): Promise<VehicleEntry> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("vehicle_entries")
      .insert({
        ...input,
        status: "INSIDE",
        exit_time: null,
        security_officer: input.security_officer || user.full_name,
      })
      .select("*")
      .single();
    if (error) throw error;
    await writeAudit({
      user,
      action: "Vehicle Entry",
      module: "security",
      recordId: data.id,
      newData: data,
    });
    return data as VehicleEntry;
  }

  let row!: VehicleEntry;
  updateStore((s) => {
    row = {
      ...input,
      id: uid("vh"),
      status: "INSIDE",
      exit_time: null,
      security_officer: input.security_officer || user.full_name,
      created_at: nowISO(),
    };
    s.vehicle_entries.unshift(row);
    s.audit_logs.unshift({
      id: uid("aud"),
      user_id: user.id,
      action: "Vehicle Entry",
      module: "security",
      record_id: row.id,
      old_data: null,
      new_data: row,
      ip_address: null,
      created_at: nowISO(),
    });
  });
  return row;
}

export async function exitVehicle(id: string, user: Profile): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("vehicle_entries")
      .update({ status: "EXITED", exit_time: nowISO() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    await writeAudit({
      user,
      action: "Vehicle Exit",
      module: "security",
      recordId: id,
      newData: data,
    });
    return;
  }
  updateStore((s) => {
    const idx = s.vehicle_entries.findIndex((v) => v.id === id);
    if (idx < 0) return;
    const old = s.vehicle_entries[idx];
    s.vehicle_entries[idx] = { ...old, status: "EXITED", exit_time: nowISO() };
    s.audit_logs.unshift({
      id: uid("aud"),
      user_id: user.id,
      action: "Vehicle Exit",
      module: "security",
      record_id: id,
      old_data: old,
      new_data: s.vehicle_entries[idx],
      ip_address: null,
      created_at: nowISO(),
    });
  });
}

export async function listMaterialEntries(): Promise<MaterialGateEntry[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("material_gate_entries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as MaterialGateEntry[];
  }
  return readStore().material_gate_entries;
}

export async function createMaterialEntry(
  input: Omit<MaterialGateEntry, "id" | "created_at">,
  user: Profile
): Promise<MaterialGateEntry> {
  if (input.entry_type === "OUTWARD" && !input.approved_by?.trim()) {
    throw new Error("Material outward requires authorized approval");
  }

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("material_gate_entries")
      .insert({
        ...input,
        security_verified_by: input.security_verified_by || user.full_name,
      })
      .select("*")
      .single();
    if (error) throw error;
    await writeAudit({
      user,
      action: input.entry_type === "INWARD" ? "Material Inward" : "Material Outward",
      module: "security",
      recordId: data.id,
      newData: data,
    });
    return data as MaterialGateEntry;
  }

  let row!: MaterialGateEntry;
  updateStore((s) => {
    row = {
      ...input,
      id: uid("mg"),
      security_verified_by: input.security_verified_by || user.full_name,
      created_at: nowISO(),
    };
    s.material_gate_entries.unshift(row);
    s.audit_logs.unshift({
      id: uid("aud"),
      user_id: user.id,
      action: input.entry_type === "INWARD" ? "Material Inward" : "Material Outward",
      module: "security",
      record_id: row.id,
      old_data: null,
      new_data: row,
      ip_address: null,
      created_at: nowISO(),
    });
  });
  return row;
}

export async function listNotifications(user: Profile): Promise<SecurityNotification[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("security_notifications")
      .select("*")
      .or(
        `recipient_user_id.eq.${user.id},recipient_role.eq.${user.role},recipient_role.is.null`
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []) as SecurityNotification[];
  }
  const all = readStore().security_notifications;
  return all.filter(
    (n) =>
      !n.recipient_role ||
      n.recipient_role === user.role ||
      n.recipient_user_id === user.id ||
      user.role === "SUPER_ADMIN" ||
      (user.role === "SECURITY_HEAD" && n.recipient_role?.startsWith("SECURITY"))
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    await supabase.from("security_notifications").update({ is_read: true }).eq("id", id);
    return;
  }
  updateStore((s) => {
    const idx = s.security_notifications.findIndex((n) => n.id === id);
    if (idx >= 0) s.security_notifications[idx] = { ...s.security_notifications[idx], is_read: true };
  });
}

export function getLocalCeoApprovalPath(ceoRequestId: string): string {
  return `/ceo-approval/${ceoRequestId}?local=1`;
}
