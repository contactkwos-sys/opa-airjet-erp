import type { LoomStatus, LoomType, OpaLoom, OpaProductionEntry } from "@/types/database";
import { fleet, production as prodDemo, operations } from "@/data";

type Row = Record<string, unknown> & { id: string };

const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();
const id = (prefix: string, n: number) =>
  `00000000-0000-4000-8000-${prefix}${String(n).padStart(8, "0")}`.slice(0, 36);

/** Demo looms: D01–D36 (Dobby), P01–P36 (Plain) — 72 machines */
export function buildDemoLooms(): OpaLoom[] {
  const ts = now();
  const looms: OpaLoom[] = [];
  let running = 0;
  let stopped = 0;
  let breakdown = 0;

  for (let i = 1; i <= 72; i++) {
    const loom_type: LoomType = i <= 36 ? "DOBBY" : "PLAIN";
    const loom_code =
      loom_type === "DOBBY"
        ? `D${String(i).padStart(2, "0")}`
        : `P${String(i - 36).padStart(2, "0")}`;
    const loom_number = loom_code;

    let status: LoomStatus = "RUNNING";
    if (breakdown < fleet.breakdown && i % 23 === 0) {
      status = "BREAKDOWN";
      breakdown++;
    } else if (stopped < fleet.stopped && i % 13 === 0) {
      status = "STOPPED";
      stopped++;
    } else if (running < fleet.running) {
      status = "RUNNING";
      running++;
    } else if (stopped < fleet.stopped) {
      status = "STOPPED";
      stopped++;
    } else {
      status = "BREAKDOWN";
      breakdown++;
    }

    looms.push({
      id: `demo-loom-${i}`,
      loom_number,
      loom_code,
      loom_type,
      make: "Toyota",
      model: loom_type === "DOBBY" ? "JAT810-D" : "JAT810",
      serial_number: `SN-${1000 + i}`,
      installation_date: "2022-01-15",
      width: 190,
      reed: 72,
      pick: 68,
      rpm: status === "RUNNING" ? 850 : 0,
      production_capacity: 1200,
      department: "Production",
      operator_name: status === "RUNNING" ? `OP-${String((i % 24) + 1).padStart(2, "0")}` : null,
      motor: "AC",
      controller: "Electronic",
      dobby_unit: loom_type === "DOBBY" ? "Staubli" : null,
      electronic_components: [],
      current_article: status === "RUNNING" ? `ART-${(i % 12) + 1}` : null,
      current_quality: "A",
      current_operator_id: null,
      current_shift_id: null,
      status,
      location: i <= 36 ? "Shed A" : "Shed B",
      notes: null,
      is_active: true,
      created_at: ts,
      updated_at: ts,
    });
  }
  return looms;
}

export function buildDemoProductionEntries(looms: OpaLoom[]): OpaProductionEntry[] {
  const d = today();
  return looms.slice(0, 18).map((loom, idx) => {
    const opening = 1000 + idx * 50;
    const prod = loom.status === "RUNNING" ? 900 + (idx % 7) * 40 : 120 + idx * 5;
    return {
      id: `demo-pe-${idx}`,
      entry_number: `PE-${d.replace(/-/g, "")}-${String(idx + 1).padStart(3, "0")}`,
      entry_date: d,
      shift_id: null,
      loom_id: loom.id,
      article_id: null,
      opening_meter: opening,
      closing_meter: opening + prod,
      production_meter: prod,
      production_kg: Math.round(prod * 0.18 * 10) / 10,
      running_hours: loom.status === "RUNNING" ? 7.5 : 2,
      downtime_hours: loom.status === "RUNNING" ? 0.5 : 5,
      efficiency: loom.status === "RUNNING" ? 90 + (idx % 8) : 35,
      operator_id: null,
      supervisor_id: null,
      remarks: null,
      created_at: now(),
      updated_at: now(),
    };
  });
}

export const demoKpis = {
  fleet,
  production: prodDemo,
  operations,
  rejectionPct: 1.8,
  downtimeHours: 42,
  costPerMeter: 18.4,
  inventoryValueLakh: 128,
  purchasePendingValue: 6.4,
  visitorsToday: 14,
  ceoMeetingsPending: 2,
  dispatchMeters: 24500,
  receivablesLakh: 86,
};

const d = today();

/** Seed-like demo rows keyed by table name for ModulePage / api.listRows */
export const DEMO_BY_TABLE: Record<string, Row[]> = {
  opa_loom_stoppages: [
    {
      id: id("st", 1),
      loom_id: "demo-loom-13",
      reason: "WARP_BREAK",
      start_time: `${d}T08:15:00+05:30`,
      end_time: `${d}T08:42:00+05:30`,
      department: "Production",
      remarks: "Warp break on left side",
      duration_minutes: 27,
    },
    {
      id: id("st", 2),
      loom_id: "demo-loom-23",
      reason: "BREAKDOWN",
      start_time: `${d}T06:05:00+05:30`,
      end_time: null,
      department: "Maintenance",
      remarks: "Main motor trip",
      duration_minutes: null,
    },
    {
      id: id("st", 3),
      loom_id: "demo-loom-10",
      reason: "BREAKDOWN",
      start_time: `${d}T04:10:00+05:30`,
      end_time: `${d}T07:40:00+05:30`,
      department: "Maintenance",
      remarks: "Weft feeder jam",
      duration_minutes: 210,
    },
    {
      id: id("st", 4),
      loom_id: "demo-loom-45",
      reason: "BREAKDOWN",
      start_time: `${d}T09:00:00+05:30`,
      end_time: `${d}T10:15:00+05:30`,
      department: "Maintenance",
      remarks: "Air pressure drop",
      duration_minutes: 75,
    },
    {
      id: id("st", 5),
      loom_id: "demo-loom-23",
      reason: "BREAKDOWN",
      start_time: `${d}T01:00:00+05:30`,
      end_time: `${d}T03:30:00+05:30`,
      department: "Maintenance",
      remarks: "Previous motor trip",
      duration_minutes: 150,
    },
  ],
  opa_production_targets: [
    {
      id: id("tg", 1),
      target_type: "DAILY",
      target_date: d,
      loom_type: null,
      loom_id: null,
      target_meter: 72000,
      target_kg: 12960,
      actual_meter: 68450,
      actual_kg: 12321,
      remarks: "Plant daily target",
    },
    {
      id: id("tg", 2),
      target_type: "SHIFT",
      target_date: d,
      loom_type: "DOBBY",
      loom_id: null,
      target_meter: 24000,
      target_kg: 4320,
      actual_meter: 23100,
      actual_kg: 4158,
      remarks: "Shift A — Dobby",
    },
    {
      id: id("tg", 3),
      target_type: "LOOM",
      target_date: d,
      loom_type: "DOBBY",
      loom_id: "demo-loom-1",
      target_meter: 1100,
      target_kg: 198,
      actual_meter: 980,
      actual_kg: 176,
      remarks: "D01 daily loom target",
    },
    {
      id: id("tg", 4),
      target_type: "MONTHLY",
      target_date: `${d.slice(0, 8)}01`,
      loom_type: null,
      loom_id: null,
      target_meter: 2100000,
      target_kg: 378000,
      actual_meter: 1684500,
      actual_kg: 303210,
      remarks: "Plant monthly target",
    },
  ],
  opa_production_plans: [
    {
      id: id("pl", 1),
      plan_number: `PLN-${d.replace(/-/g, "")}-001`,
      plan_date: d,
      planned_meter: 1200,
      actual_meter: 980,
      status: "IN_PROGRESS",
      remarks: "ART-3 on DOBBY 05",
    },
    {
      id: id("pl", 2),
      plan_number: `PLN-${d.replace(/-/g, "")}-002`,
      plan_date: d,
      planned_meter: 1100,
      actual_meter: 0,
      status: "APPROVED",
      remarks: "ART-7 on PLAIN 40",
    },
  ],
  opa_quality_inspections: [
    {
      id: id("qc", 1),
      inspection_number: `QC-${d.replace(/-/g, "")}-001`,
      inspection_date: d,
      result: "PASS",
      grade: "A",
      sample_meters: 50,
      remarks: "No major defects",
    },
    {
      id: id("qc", 2),
      inspection_number: `QC-${d.replace(/-/g, "")}-002`,
      inspection_date: d,
      result: "HOLD",
      grade: "B",
      sample_meters: 40,
      remarks: "Weft bars — recheck",
    },
  ],
  opa_inventory_items: [
    {
      id: id("inv", 1),
      item_code: "SP-REED-72",
      name: "Reed 72s",
      category: "SPARES",
      uom: "PCS",
      reorder_level: 5,
      min_stock: 3,
      max_stock: 40,
      current_qty: 4,
      unit_cost: 850,
      is_active: true,
    },
    {
      id: id("inv", 2),
      item_code: "YARN-40S-CO",
      name: "40s Cotton Warp",
      category: "YARN",
      uom: "KG",
      reorder_level: 500,
      min_stock: 200,
      max_stock: 5000,
      current_qty: 320,
      unit_cost: 210,
      is_active: true,
    },
    {
      id: id("inv", 3),
      item_code: "BEAM-WRAP-18K",
      name: "Warp beam blank 18k",
      category: "BEAM",
      uom: "PCS",
      reorder_level: 8,
      current_qty: 6,
      unit_cost: 4200,
      is_active: true,
    },
    {
      id: id("inv", 4),
      item_code: "FAB-GREIGE-A",
      name: "Greige fabric roll A",
      category: "FABRIC",
      uom: "M",
      reorder_level: 1000,
      current_qty: 2450,
      unit_cost: 42,
      is_active: true,
    },
    {
      id: id("inv", 5),
      item_code: "GEN-OIL-AJ",
      name: "Air-jet loom oil",
      category: "CONSUMABLE",
      uom: "LTR",
      reorder_level: 20,
      current_qty: 48,
      unit_cost: 320,
      is_active: true,
    },
  ],
  opa_yarn_master: [
    {
      id: id("ym", 1),
      yarn_code: "Y-40S-CO",
      name: "40s Cotton",
      count: "40s",
      blend: "100% Cotton",
      color: "Natural",
      uom: "KG",
      current_qty: 4200,
      unit_cost: 210,
      is_active: true,
    },
    {
      id: id("ym", 2),
      yarn_code: "Y-60S-PC",
      name: "60s Poly-Cotton",
      count: "60s",
      blend: "65/35 PC",
      color: "White",
      uom: "KG",
      current_qty: 1800,
      unit_cost: 185,
      is_active: true,
    },
  ],
  opa_yarn_transactions: [
    {
      id: id("yt", 1),
      txn_type: "RECEIPT",
      txn_date: d,
      quantity: 1200,
      lot_number: "LOT-A12",
      remarks: "PO receipt",
    },
  ],
  opa_beams: [
    {
      id: id("bm", 1),
      beam_number: "BM-2401",
      status: "RUNNING",
      length_meters: 18000,
      remaining_meters: 4200,
      loom_id: "demo-loom-5",
    },
    {
      id: id("bm", 2),
      beam_number: "BM-2402",
      status: "AVAILABLE",
      length_meters: 20000,
      remaining_meters: 20000,
      loom_id: null,
    },
  ],
  opa_greige_stock: [
    {
      id: id("gr", 1),
      lot_number: "GR-8801",
      meters: 2450,
      quality_grade: "A",
      location: "GREIGE STORE",
      status: "AVAILABLE",
    },
    {
      id: id("gr", 2),
      lot_number: "GR-8802",
      meters: 980,
      quality_grade: "B",
      location: "GREIGE STORE",
      status: "QC_HOLD",
    },
  ],
  opa_spare_parts: [
    {
      id: id("sp", 1),
      part_code: "SP-NOZZLE-01",
      name: "Main nozzle",
      current_qty: 12,
      reorder_level: 4,
      uom: "PCS",
      is_active: true,
    },
    {
      id: id("sp", 2),
      part_code: "SP-RELAY-AC",
      name: "AC drive relay",
      current_qty: 2,
      reorder_level: 3,
      uom: "PCS",
      is_active: true,
    },
  ],
  opa_purchase_requisitions: [
    {
      id: id("pr", 1),
      pr_number: `PR-${d.replace(/-/g, "")}-001`,
      request_date: d,
      status: "SUBMITTED",
      priority: "HIGH",
      remarks: "Nozzles for Shed A",
    },
  ],
  opa_purchase_orders: [
    {
      id: id("po", 1),
      po_number: `PO-${d.replace(/-/g, "")}-001`,
      po_date: d,
      status: "APPROVED",
      total_amount: 185000,
      remarks: "Yarn indent Q2",
    },
  ],
  opa_grns: [
    {
      id: id("gn", 1),
      grn_number: `GRN-${d.replace(/-/g, "")}-001`,
      grn_date: d,
      status: "COMPLETED",
      remarks: "Partial yarn receipt",
    },
  ],
  opa_suppliers: [
    {
      id: id("su", 1),
      supplier_code: "SUP-001",
      name: "Indo Yarn Traders",
      contact_person: "Ravi Mehta",
      mobile: "9876543210",
      city: "Surat",
      is_active: true,
    },
    {
      id: id("su", 2),
      supplier_code: "SUP-002",
      name: "Toyota Spare Hub",
      contact_person: "Ankit Shah",
      mobile: "9123456780",
      city: "Ahmedabad",
      is_active: true,
    },
  ],
  opa_customers: [
    {
      id: id("cu", 1),
      customer_code: "CUS-001",
      name: "Textile Mart Pvt Ltd",
      contact_person: "Neha Patel",
      mobile: "9988776655",
      city: "Mumbai",
      is_active: true,
    },
    {
      id: id("cu", 2),
      customer_code: "CUS-002",
      name: "West Coast Fabrics",
      contact_person: "Imran Khan",
      mobile: "9811122233",
      city: "Delhi",
      is_active: true,
    },
  ],
  opa_sales_orders: [
    {
      id: id("so", 1),
      so_number: `SO-${d.replace(/-/g, "")}-001`,
      so_date: d,
      status: "APPROVED",
      total_amount: 420000,
      remarks: "Greige ART-3",
    },
  ],
  opa_dispatches: [
    {
      id: id("dp", 1),
      dispatch_number: `DSP-${d.replace(/-/g, "")}-001`,
      dispatch_date: d,
      status: "COMPLETED",
      vehicle_number: "GJ05AB1234",
      meters: 24500,
    },
  ],
  opa_maintenance_requests: [
    {
      id: id("mr", 1),
      request_number: `MR-${d.replace(/-/g, "")}-001`,
      issue_type: "ELECTRONICAL",
      description: "Dobby controller fault",
      priority: "HIGH",
      status: "OPEN",
      request_date: now(),
    },
  ],
  opa_maintenance_work_orders: [
    {
      id: id("wo", 1),
      wo_number: `WO-${d.replace(/-/g, "")}-001`,
      work_description: "Replace dobby PCB",
      priority: "HIGH",
      status: "IN_PROGRESS",
      labour_hours: 2.5,
    },
  ],
  opa_pm_schedules: [
    {
      id: id("pm", 1),
      schedule_code: "PM-MONTHLY-DOBBY",
      name: "Monthly Dobby checklist",
      frequency: "MONTHLY",
      next_due_date: d,
      is_active: true,
    },
    {
      id: id("pm", 2),
      schedule_code: "PM-WEEKLY-AIR",
      name: "Weekly air pressure audit",
      frequency: "WEEKLY",
      next_due_date: d,
      is_active: true,
    },
  ],
  opa_employees: [
    {
      id: id("em", 1),
      employee_code: "EMP-1001",
      full_name: "Suresh Yadav",
      designation: "Loom Operator",
      department: "Production",
      mobile: "9876501234",
      is_active: true,
    },
    {
      id: id("em", 2),
      employee_code: "EMP-1002",
      full_name: "Priya Sharma",
      designation: "Supervisor",
      department: "Production",
      mobile: "9876505678",
      is_active: true,
    },
  ],
  opa_attendance: [
    {
      id: id("at", 1),
      attendance_date: d,
      status: "PRESENT",
      check_in: `${d}T06:02:00+05:30`,
      check_out: null,
      employee_name: "Suresh Yadav",
    },
    {
      id: id("at", 2),
      attendance_date: d,
      status: "LEAVE",
      check_in: null,
      check_out: null,
      employee_name: "Priya Sharma",
    },
  ],
  opa_receipts: [
    {
      id: id("rc", 1),
      receipt_number: `RCT-${d.replace(/-/g, "")}-001`,
      receipt_date: d,
      amount: 125000,
      status: "PAID",
      customer_name: "Textile Mart Pvt Ltd",
      due_date: d,
      days_overdue: 0,
    },
    {
      id: id("rc", 2),
      receipt_number: `RCT-OPEN-001`,
      receipt_date: "2026-07-01",
      amount: 860000,
      status: "OVERDUE",
      customer_name: "West Coast Fabrics",
      due_date: "2026-07-31",
      days_overdue: 45,
      ageing_bucket: "31-60",
    },
  ],
  opa_payments: [
    {
      id: id("py", 1),
      payment_number: `PAY-${d.replace(/-/g, "")}-001`,
      payment_date: d,
      amount: 185000,
      status: "PAID",
      supplier_name: "Indo Yarn Traders",
      due_date: d,
      days_overdue: 0,
    },
    {
      id: id("py", 2),
      payment_number: `PAY-OPEN-001`,
      payment_date: "2026-06-15",
      amount: 640000,
      status: "OVERDUE",
      supplier_name: "Toyota Spare Hub",
      due_date: "2026-07-15",
      days_overdue: 75,
      ageing_bucket: "61-90",
    },
  ],
  opa_costing_entries: [
    {
      id: id("cs", 1),
      costing_number: `CST-${d.replace(/-/g, "")}-001`,
      entry_date: d,
      article_code: "ART-3",
      yarn_cost: 8.2,
      labour_cost: 2.1,
      power_cost: 3.4,
      overhead_cost: 1.8,
      cost_per_meter: 15.5,
      meters: 12000,
    },
  ],
  opa_visitors: [
    {
      id: id("vi", 1),
      visitor_code: "VIS-001",
      full_name: "Amit Desai",
      mobile: "9000011111",
      company: "SpareTech",
      is_blacklisted: false,
    },
    {
      id: id("vi", 2),
      visitor_code: "VIS-002",
      full_name: "Kavita Nair",
      mobile: "9000022222",
      company: "Buyer Co",
      is_blacklisted: false,
    },
  ],
  opa_ceo_visit_requests: [
    {
      id: id("cv", 1),
      request_number: `CEO-${d.replace(/-/g, "")}-001`,
      visitor_name: "Kavita Nair",
      visitor_company: "Buyer Co",
      visitor_mobile: "9000022222",
      purpose: "Quarterly volume discussion",
      host_name: "Factory Manager",
      proposed_visit_at: `${d}T16:00:00+05:30`,
      status: "PENDING",
    },
    {
      id: id("cv", 2),
      request_number: `CEO-${d.replace(/-/g, "")}-002`,
      visitor_name: "Rahul Bose",
      visitor_company: "Bank Partner",
      visitor_mobile: "9000033333",
      purpose: "Facility tour",
      host_name: "Director",
      proposed_visit_at: `${d}T11:00:00+05:30`,
      status: "APPROVED",
    },
  ],
  opa_gate_passes: [
    {
      id: id("gp", 1),
      pass_number: `GP-${d.replace(/-/g, "")}-001`,
      pass_type: "VISITOR",
      purpose: "CEO visit",
      status: "ACTIVE",
      valid_from: now(),
    },
  ],
  opa_vehicle_entries: [
    {
      id: id("ve", 1),
      entry_number: `VE-${d.replace(/-/g, "")}-001`,
      vehicle_number: "GJ05CD7788",
      driver_name: "Ramesh",
      purpose: "Yarn delivery",
      entry_at: now(),
      exit_at: null,
      direction: "INWARD",
    },
  ],
  opa_material_gate_entries: [
    {
      id: id("mg", 1),
      entry_number: `MG-${d.replace(/-/g, "")}-001`,
      direction: "INWARD",
      material_description: "40s Cotton yarn 20 bags",
      vehicle_number: "GJ05CD7788",
      entry_at: now(),
    },
  ],
  opa_security_incidents: [
    {
      id: id("si", 1),
      incident_number: `INC-${d.replace(/-/g, "")}-001`,
      incident_at: now(),
      severity: "MEDIUM",
      title: "Unauthorized parking near Shed B",
      status: "OPEN",
    },
  ],
  opa_notifications: [
    {
      id: id("nt", 1),
      title: "CEO visit pending approval",
      body: "Buyer Co visit awaiting WhatsApp response",
      channel: "IN_APP",
      is_read: false,
      created_at: now(),
    },
    {
      id: id("nt", 2),
      title: "Spare below reorder",
      body: "AC drive relay stock is 2 (reorder 3)",
      channel: "IN_APP",
      is_read: true,
      created_at: now(),
    },
  ],
  opa_approvals: [
    {
      id: id("ap", 1),
      entity_type: "purchase_order",
      entity_id: id("po", 1),
      status: "PENDING",
      requested_at: now(),
      remarks: "PO over L1 threshold",
    },
  ],
  opa_documents: [
    {
      id: id("dc", 1),
      title: "Toyota JAT810 Manual",
      category: "MAINTENANCE",
      file_name: "jat810-manual.pdf",
      created_at: now(),
    },
  ],
  opa_audit_logs: [
    {
      id: id("au", 1),
      action: "LOGIN",
      module: "auth",
      user_name: "Demo Super Admin",
      created_at: now(),
    },
    {
      id: id("au", 2),
      action: "CREATE",
      module: "production",
      user_name: "Demo Super Admin",
      record_id: "demo-pe-0",
      created_at: now(),
    },
  ],
  opa_alerts: [
    {
      id: id("al", 1),
      type: "BREAKDOWN",
      severity: "HIGH",
      title: "DOBBY LOOM 23 breakdown",
      body: "Main motor trip — open maintenance request",
      module: "looms",
      is_resolved: false,
      created_at: now(),
    },
    {
      id: id("al", 2),
      type: "INVENTORY",
      severity: "MEDIUM",
      title: "Spare reorder alert",
      body: "AC drive relay below reorder level",
      module: "inventory",
      is_resolved: false,
      created_at: now(),
    },
  ],
  opa_company_settings: [
    {
      id: id("co", 1),
      company_name: "OPA GROUP OF INDIA",
      timezone: "Asia/Kolkata",
      currency: "INR",
      fiscal_year: "April-March",
      loom_count: 72,
      dobby_count: 36,
      plain_count: 36,
      address: "India",
      whatsapp_settings: {
        ceo_visit_enabled: true,
        notify_ceo_on_visit: true,
        secrets: "configured on server",
      },
    },
  ],
  opa_production_entries: buildDemoProductionEntries(buildDemoLooms()).map((e) => ({
    ...e,
  })),
  opa_looms: buildDemoLooms().map((l) => ({ ...l })),
  opa_shifts: [
    { id: id("sh", 1), code: "A", name: "SHIFT A", start_time: "06:00", end_time: "14:00", is_active: true },
    { id: id("sh", 2), code: "B", name: "SHIFT B", start_time: "14:00", end_time: "22:00", is_active: true },
    { id: id("sh", 3), code: "C", name: "SHIFT C", start_time: "22:00", end_time: "06:00", is_active: true },
  ],
};

export function getDemoRows(table: string): Row[] {
  const rows = DEMO_BY_TABLE[table];
  if (!rows) return [];
  return rows.map((r) => ({ ...r }));
}
