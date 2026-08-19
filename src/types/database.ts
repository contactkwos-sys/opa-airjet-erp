/** TypeScript types aligned with opa_* Supabase schema. */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OpaRole =
  | "SUPER_ADMIN"
  | "COMPANY_ADMIN"
  | "CEO"
  | "DIRECTOR"
  | "FACTORY_MANAGER"
  | "PRODUCTION_MANAGER"
  | "PRODUCTION_SUPERVISOR"
  | "LOOM_OPERATOR"
  | "MAINTENANCE_HEAD"
  | "TECHNICIAN"
  | "STORE_MANAGER"
  | "PURCHASE_MANAGER"
  | "SALES_MANAGER"
  | "ACCOUNTS"
  | "HR"
  | "SECURITY_HEAD"
  | "SECURITY_GUARD"
  | "QUALITY_MANAGER";

export type LoomType = "DOBBY" | "PLAIN";
export type LoomStatus =
  | "RUNNING"
  | "STOPPED"
  | "BREAKDOWN"
  | "MAINTENANCE"
  | "IDLE";

export type DocStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "PARTIAL"
  | "COMPLETED"
  | "CANCELLED"
  | "CLOSED";

export type AlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type CeoVisitStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "RESCHEDULED"
  | "COMPLETED";

export type PaymentStatus =
  | "PENDING"
  | "PARTIAL"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export interface OpaProfile {
  id: string;
  email: string;
  full_name: string;
  role: OpaRole;
  department_id: string | null;
  employee_id: string | null;
  mobile: string | null;
  is_active: boolean;
  permissions: Json;
  created_at: string;
  updated_at: string;
}

export interface OpaLoom {
  id: string;
  loom_number: string;
  loom_type: LoomType;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  installation_date: string | null;
  width: number | null;
  reed: number | null;
  pick: number | null;
  rpm: number | null;
  motor: string | null;
  controller: string | null;
  dobby_unit: string | null;
  electronic_components: Json;
  current_article: string | null;
  current_quality: string | null;
  current_operator_id: string | null;
  current_shift_id: string | null;
  status: LoomStatus;
  location: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpaProductionEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  shift_id: string | null;
  loom_id: string;
  article_id: string | null;
  opening_meter: number;
  closing_meter: number;
  production_meter: number;
  production_kg: number | null;
  running_hours: number | null;
  downtime_hours: number | null;
  efficiency: number | null;
  operator_id: string | null;
  supervisor_id: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpaAlert {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  body: string | null;
  module: string | null;
  record_id: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpaAuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  module: string;
  record_id: string | null;
  old_value: Json | null;
  new_value: Json | null;
  ip_address: string | null;
  created_at: string;
}

export interface OpaInventoryItem {
  id: string;
  item_code: string;
  name: string;
  category: string | null;
  uom: string;
  store_id: string | null;
  reorder_level: number | null;
  min_stock: number | null;
  max_stock: number | null;
  current_qty: number;
  unit_cost: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpaYarnMaster {
  id: string;
  yarn_code: string;
  name: string;
  count: string | null;
  blend: string | null;
  color: string | null;
  current_qty: number;
  unit_cost: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpaBeam {
  id: string;
  beam_number: string;
  yarn_id: string | null;
  article_id: string | null;
  loom_id: string | null;
  length_meters: number | null;
  remaining_meters: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface OpaGreigeStock {
  id: string;
  lot_number: string;
  article_id: string | null;
  loom_id: string | null;
  meters: number;
  kg: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface OpaSparePart {
  id: string;
  part_code: string;
  name: string;
  category: string | null;
  current_qty: number;
  reorder_level: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpaPurchaseRequisition {
  id: string;
  pr_number: string;
  request_date: string;
  status: DocStatus;
  priority: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpaPurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  po_date: string;
  total_amount: number | null;
  status: DocStatus;
  payment_status: PaymentStatus;
  created_at: string;
  updated_at: string;
}

export interface OpaGrn {
  id: string;
  grn_number: string;
  po_id: string | null;
  supplier_id: string | null;
  grn_date: string;
  status: DocStatus;
  created_at: string;
  updated_at: string;
}

export interface OpaSupplier {
  id: string;
  supplier_code: string;
  name: string;
  email: string | null;
  mobile: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpaCustomer {
  id: string;
  customer_code: string;
  name: string;
  email: string | null;
  mobile: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpaSalesOrder {
  id: string;
  so_number: string;
  customer_id: string;
  so_date: string;
  total_amount: number | null;
  status: DocStatus;
  payment_status: PaymentStatus;
  created_at: string;
  updated_at: string;
}

export interface OpaDispatch {
  id: string;
  dispatch_number: string;
  so_id: string | null;
  customer_id: string | null;
  dispatch_date: string;
  status: DocStatus;
  created_at: string;
  updated_at: string;
}

export interface OpaMaintenanceRequest {
  id: string;
  request_number: string;
  loom_id: string | null;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface OpaWorkOrder {
  id: string;
  wo_number: string;
  request_id: string | null;
  loom_id: string | null;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

export interface OpaPmSchedule {
  id: string;
  schedule_code: string;
  name: string;
  loom_id: string | null;
  frequency: string;
  next_due_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpaEmployee {
  id: string;
  employee_code: string;
  full_name: string;
  designation: string | null;
  mobile: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpaAttendance {
  id: string;
  employee_id: string;
  attendance_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface OpaVisitor {
  id: string;
  visitor_code: string;
  full_name: string;
  mobile: string | null;
  company: string | null;
  is_blacklisted: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpaCeoVisitRequest {
  id: string;
  request_number: string;
  visitor_name: string;
  visitor_mobile: string | null;
  visitor_company: string | null;
  purpose: string;
  proposed_visit_at: string | null;
  status: CeoVisitStatus;
  action_token: string | null;
  action_token_expires_at: string | null;
  ceo_notes: string | null;
  approved_visit_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpaGatePass {
  id: string;
  pass_number: string;
  pass_type: string;
  purpose: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface OpaVehicleEntry {
  id: string;
  entry_number: string;
  vehicle_number: string;
  driver_name: string | null;
  direction: string;
  entry_at: string;
  exit_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpaMaterialGateEntry {
  id: string;
  entry_number: string;
  direction: string;
  material_description: string;
  quantity: number | null;
  entry_at: string;
  created_at: string;
  updated_at: string;
}

export interface OpaSecurityIncident {
  id: string;
  incident_number: string;
  title: string;
  severity: AlertSeverity;
  status: string;
  incident_at: string;
  created_at: string;
  updated_at: string;
}

export interface OpaCostingEntry {
  id: string;
  costing_number: string;
  entry_date: string;
  total_cost: number | null;
  meters: number | null;
  created_at: string;
  updated_at: string;
}

export interface OpaReceipt {
  id: string;
  receipt_number: string;
  customer_id: string;
  amount: number;
  status: PaymentStatus;
  receipt_date: string;
  created_at: string;
  updated_at: string;
}

export interface OpaPayment {
  id: string;
  payment_number: string;
  supplier_id: string;
  amount: number;
  status: PaymentStatus;
  payment_date: string;
  created_at: string;
  updated_at: string;
}

export interface OpaQualityInspection {
  id: string;
  inspection_number: string;
  inspection_date: string;
  loom_id: string | null;
  result: string;
  created_at: string;
  updated_at: string;
}

export interface OpaProductionPlan {
  id: string;
  plan_number: string;
  plan_date: string;
  planned_meter: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface OpaProductionTarget {
  id: string;
  target_type: string;
  target_date: string;
  target_meter: number;
  actual_meter: number | null;
  created_at: string;
  updated_at: string;
}

export interface OpaLoomStoppage {
  id: string;
  loom_id: string;
  start_time: string;
  end_time: string | null;
  reason: string;
  created_at: string;
  updated_at: string;
}

export interface OpaNotification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpaApproval {
  id: string;
  module: string;
  record_id: string;
  status: string;
  level: number;
  created_at: string;
  updated_at: string;
}

export interface OpaDocument {
  id: string;
  module: string;
  record_id: string;
  file_name: string;
  storage_path: string;
  created_at: string;
  updated_at: string;
}

type TableDef<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      opa_profiles: TableDef<OpaProfile>;
      opa_looms: TableDef<OpaLoom>;
      opa_production_entries: TableDef<OpaProductionEntry>;
      opa_alerts: TableDef<OpaAlert>;
      opa_audit_logs: TableDef<OpaAuditLog, Omit<OpaAuditLog, "id" | "created_at"> & { id?: string; created_at?: string }>;
      opa_inventory_items: TableDef<OpaInventoryItem>;
      opa_yarn_master: TableDef<OpaYarnMaster>;
      opa_beams: TableDef<OpaBeam>;
      opa_greige_stock: TableDef<OpaGreigeStock>;
      opa_spare_parts: TableDef<OpaSparePart>;
      opa_purchase_requisitions: TableDef<OpaPurchaseRequisition>;
      opa_purchase_orders: TableDef<OpaPurchaseOrder>;
      opa_grns: TableDef<OpaGrn>;
      opa_suppliers: TableDef<OpaSupplier>;
      opa_customers: TableDef<OpaCustomer>;
      opa_sales_orders: TableDef<OpaSalesOrder>;
      opa_dispatches: TableDef<OpaDispatch>;
      opa_maintenance_requests: TableDef<OpaMaintenanceRequest>;
      opa_maintenance_work_orders: TableDef<OpaWorkOrder>;
      opa_pm_schedules: TableDef<OpaPmSchedule>;
      opa_employees: TableDef<OpaEmployee>;
      opa_attendance: TableDef<OpaAttendance>;
      opa_visitors: TableDef<OpaVisitor>;
      opa_ceo_visit_requests: TableDef<OpaCeoVisitRequest>;
      opa_gate_passes: TableDef<OpaGatePass>;
      opa_vehicle_entries: TableDef<OpaVehicleEntry>;
      opa_material_gate_entries: TableDef<OpaMaterialGateEntry>;
      opa_security_incidents: TableDef<OpaSecurityIncident>;
      opa_costing_entries: TableDef<OpaCostingEntry>;
      opa_receipts: TableDef<OpaReceipt>;
      opa_payments: TableDef<OpaPayment>;
      opa_quality_inspections: TableDef<OpaQualityInspection>;
      opa_production_plans: TableDef<OpaProductionPlan>;
      opa_production_targets: TableDef<OpaProductionTarget>;
      opa_loom_stoppages: TableDef<OpaLoomStoppage>;
      opa_notifications: TableDef<OpaNotification>;
      opa_approvals: TableDef<OpaApproval>;
      opa_documents: TableDef<OpaDocument>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      opa_role: OpaRole;
      opa_loom_type: LoomType;
      opa_loom_status: LoomStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
