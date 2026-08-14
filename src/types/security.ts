export type AppRole =
  | "SUPER_ADMIN"
  | "CEO"
  | "DIRECTOR"
  | "SECURITY_HEAD"
  | "SECURITY_GUARD"
  | "FACTORY_MANAGER";

export type VisitorStatus =
  | "PENDING"
  | "PENDING_CEO_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "RESCHEDULED"
  | "CHECKED_IN"
  | "EXITED"
  | "CANCELLED"
  | "COMPLETED";

export type CeoDecision = "APPROVED" | "REJECTED" | "RESCHEDULED" | null;

export type PersonToMeet =
  | "CEO"
  | "DIRECTOR"
  | "GENERAL MANAGER"
  | "PRODUCTION MANAGER"
  | "MAINTENANCE MANAGER"
  | "PURCHASE MANAGER"
  | "ACCOUNTS"
  | "HR"
  | "OTHER";

export type IncidentType =
  | "Unauthorized Entry"
  | "Theft"
  | "Material Issue"
  | "Visitor Issue"
  | "Employee Issue"
  | "Vehicle Issue"
  | "Fire/Safety"
  | "Other";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type VehicleStatus = "INSIDE" | "EXITED";

export type MaterialEntryType = "INWARD" | "OUTWARD";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  mobile?: string;
  created_at: string;
}

export interface VisitorRequest {
  id: string;
  request_number: string;
  visitor_name: string;
  company_name: string;
  mobile: string;
  email: string | null;
  purpose: string;
  person_to_meet: PersonToMeet;
  department: string | null;
  requested_date: string;
  requested_time: string;
  number_of_visitors: number;
  vehicle_number: string | null;
  vehicle_type: string | null;
  id_proof_type: string | null;
  id_proof_number: string | null;
  visitor_photo_url: string | null;
  security_remarks: string | null;
  status: VisitorStatus;
  created_by: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CeoVisitRequest {
  id: string;
  visitor_request_id: string;
  request_number: string;
  status: VisitorStatus;
  ceo_decision: CeoDecision;
  ceo_remarks: string | null;
  decision_by: string | null;
  decision_at: string | null;
  rescheduled_date: string | null;
  rescheduled_time: string | null;
  approval_token_hash: string | null;
  token_expires_at: string | null;
  whatsapp_status: "PENDING_CONFIGURATION" | "SENT" | "FAILED" | "SKIPPED" | null;
  created_at: string;
  updated_at: string;
  visitor?: VisitorRequest;
}

export interface VisitorEntry {
  id: string;
  visitor_request_id: string;
  gate_pass_number: string;
  actual_arrival_time: string;
  check_in_by: string | null;
  check_in_by_name?: string | null;
  visitor_photo_url: string | null;
  id_verified: boolean;
  actual_vehicle_number: string | null;
  number_of_persons: number;
  status: "INSIDE" | "EXITED";
  exit_time: string | null;
  check_out_by: string | null;
  check_out_by_name?: string | null;
  visit_duration: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  visitor?: VisitorRequest;
}

export interface SecurityIncident {
  id: string;
  incident_number: string;
  incident_date: string;
  incident_time: string;
  location: string;
  incident_type: IncidentType;
  description: string;
  person_involved: string | null;
  security_officer: string | null;
  severity: Severity;
  action_taken: string | null;
  photo_url: string | null;
  attachment_url: string | null;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  created_at: string;
  updated_at: string;
}

export interface VehicleEntry {
  id: string;
  vehicle_number: string;
  driver_name: string;
  mobile: string | null;
  company: string | null;
  purpose: string | null;
  material: string | null;
  direction: "IN" | "OUT";
  entry_time: string;
  exit_time: string | null;
  gate_pass_number: string | null;
  security_officer: string | null;
  status: VehicleStatus;
  created_at: string;
}

export interface MaterialGateEntry {
  id: string;
  entry_type: MaterialEntryType;
  supplier_or_department: string;
  po_number: string | null;
  invoice_number: string | null;
  challan_number: string | null;
  vehicle_number: string | null;
  material: string;
  quantity: number;
  unit: string;
  purpose: string | null;
  approved_by: string | null;
  security_verified_by: string | null;
  entry_time: string;
  exit_time: string | null;
  document_url: string | null;
  photo_url: string | null;
  status: "PENDING" | "VERIFIED" | "REJECTED" | "COMPLETED";
  created_at: string;
}

export interface SecurityNotification {
  id: string;
  notification_type: string;
  reference_id: string | null;
  recipient_role: string | null;
  recipient_user_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  module: string;
  record_id: string | null;
  old_data: unknown;
  new_data: unknown;
  ip_address: string | null;
  created_at: string;
}

export interface SecurityDashboardStats {
  totalVisitorsToday: number;
  pendingRequests: number;
  ceoRequests: number;
  approved: number;
  rejected: number;
  insideFactory: number;
  exited: number;
  vehicles: number;
  materialInward: number;
  materialOutward: number;
  gatePassesIssued: number;
  securityIncidents: number;
  emergencyAlerts: number;
  securityAlerts: number;
}

export const PERSON_TO_MEET_OPTIONS: PersonToMeet[] = [
  "CEO",
  "DIRECTOR",
  "GENERAL MANAGER",
  "PRODUCTION MANAGER",
  "MAINTENANCE MANAGER",
  "PURCHASE MANAGER",
  "ACCOUNTS",
  "HR",
  "OTHER",
];

export const INCIDENT_TYPES: IncidentType[] = [
  "Unauthorized Entry",
  "Theft",
  "Material Issue",
  "Visitor Issue",
  "Employee Issue",
  "Vehicle Issue",
  "Fire/Safety",
  "Other",
];

export const SEVERITIES: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
