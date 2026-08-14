import type {
  AuditLog,
  CeoVisitRequest,
  MaterialGateEntry,
  SecurityIncident,
  SecurityNotification,
  VehicleEntry,
  VisitorEntry,
  VisitorRequest,
} from "../types/security";

const KEY = "opa_security_store_v1";

export interface LocalStore {
  visitor_requests: VisitorRequest[];
  ceo_visit_requests: CeoVisitRequest[];
  visitor_entries: VisitorEntry[];
  security_incidents: SecurityIncident[];
  vehicle_entries: VehicleEntry[];
  material_gate_entries: MaterialGateEntry[];
  security_notifications: SecurityNotification[];
  audit_logs: AuditLog[];
}

function empty(): LocalStore {
  return {
    visitor_requests: [],
    ceo_visit_requests: [],
    visitor_entries: [],
    security_incidents: [],
    vehicle_entries: [],
    material_gate_entries: [],
    security_notifications: [],
    audit_logs: [],
  };
}

export function readStore(): LocalStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...JSON.parse(raw) } as LocalStore;
  } catch {
    return empty();
  }
}

export function writeStore(store: LocalStore): void {
  localStorage.setItem(KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent("opa-security-store"));
}

export function updateStore(mutator: (store: LocalStore) => void): LocalStore {
  const store = readStore();
  mutator(store);
  writeStore(store);
  return store;
}

export function uid(prefix = "id"): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function seqNumber(prefix: string, count: number): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${prefix}-${y}${m}${day}-${String(count + 1).padStart(4, "0")}`;
}

export function subscribeStore(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener("opa-security-store", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("opa-security-store", handler);
    window.removeEventListener("storage", handler);
  };
}
