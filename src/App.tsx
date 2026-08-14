import type { ReactNode } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import { LoadingState } from "@/components/ui";
import { isSupabaseConfigured as isErpSupabaseConfigured } from "@/lib/env";

import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import LoomsPage from "@/pages/LoomsPage";
import LoomDetailPage from "@/pages/LoomDetailPage";
import ProductionEntriesPage from "@/pages/ProductionEntriesPage";
import FactoryFloorPage from "@/pages/FactoryFloorPage";
import CeoVisitMobilePage from "@/pages/ceo/CeoVisitMobilePage";
import DailyReportPage from "@/pages/executive/DailyReportPage";
import AlertsPage from "@/pages/executive/AlertsPage";
import PlanningPage from "@/pages/production/PlanningPage";
import TargetsPage from "@/pages/production/TargetsPage";
import StoppagesPage from "@/pages/production/StoppagesPage";
import QualityPage from "@/pages/quality/QualityPage";
import YarnPage from "@/pages/inventory/YarnPage";
import BeamsPage from "@/pages/inventory/BeamsPage";
import GreigePage from "@/pages/inventory/GreigePage";
import InventoryPage from "@/pages/inventory/InventoryPage";
import SparesPage from "@/pages/inventory/SparesPage";
import PurchaseRequisitionsPage from "@/pages/purchase/PurchaseRequisitionsPage";
import PurchaseOrdersPage from "@/pages/purchase/PurchaseOrdersPage";
import GrnPage from "@/pages/purchase/GrnPage";
import SuppliersPage from "@/pages/purchase/SuppliersPage";
import CustomersPage from "@/pages/sales/CustomersPage";
import SalesOrdersPage from "@/pages/sales/SalesOrdersPage";
import DispatchPage from "@/pages/sales/DispatchPage";
import MaintenanceRequestsPage from "@/pages/maintenance/MaintenanceRequestsPage";
import WorkOrdersPage from "@/pages/maintenance/WorkOrdersPage";
import PmPage from "@/pages/maintenance/PmPage";
import EmployeesPage from "@/pages/hr/EmployeesPage";
import AttendancePage from "@/pages/hr/AttendancePage";
import CostingPage from "@/pages/finance/CostingPage";
import AccountsPage from "@/pages/finance/AccountsPage";
import ReceivablesPage from "@/pages/ReceivablesPage";
import PayablesPage from "@/pages/PayablesPage";
import ReportsPage from "@/pages/system/ReportsPage";
import NotificationsPage from "@/pages/system/NotificationsPage";
import ApprovalsPage from "@/pages/system/ApprovalsPage";
import DocumentsPage from "@/pages/system/DocumentsPage";
import SearchPage from "@/pages/system/SearchPage";
import SettingsPage from "@/pages/system/SettingsPage";
import AuditPage from "@/pages/system/AuditPage";

/* Existing Security module — do not remove */
import { SecurityDashboard } from "@/modules/security/SecurityDashboard";
import { VisitorRequestsPage } from "@/modules/security/VisitorRequestsPage";
import { CeoVisitRequestsPage } from "@/modules/security/CeoVisitRequestsPage";
import {
  GatePassPage,
  VisitorHistoryPage,
  VisitorsInsidePage,
} from "@/modules/security/GateAndHistory";
import {
  MaterialGatePage,
  SecurityIncidentsPage,
  VehicleManagementPage,
} from "@/modules/security/VehiclesMaterialIncidents";
import {
  NotificationsPage as SecurityNotificationsPage,
  SecurityReportsPage,
  SecuritySettingsPage,
} from "@/modules/security/ReportsNotifications";
import { CeoApprovalPage } from "@/modules/ceo/CeoApprovalPage";
import { LoginPage as SecurityLoginPage } from "@/modules/security/LoginPage";

const SECURITY_NAV: Record<string, string> = {
  dashboard: "/security",
  visitors: "/security/visitors",
  "ceo-visits": "/security/ceo-visits",
  "gate-pass": "/security/gate-pass",
  inside: "/security/inside",
  history: "/security/history",
  vehicles: "/security/vehicles",
  "material-gate": "/security/material-gate",
  incidents: "/security/incidents",
  reports: "/security/reports",
  notifications: "/security/notifications",
  settings: "/security/settings",
};

function SecurityNav({
  children,
}: {
  children: (nav: (id: string) => void) => ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <>
      {children((id) => {
        const path = SECURITY_NAV[id] ?? `/security/${id}`;
        navigate(path);
      })}
    </>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const { session, loading, demoMode } = useAuth();
  if (loading) return <LoadingState label="Starting OPA ERP…" />;
  if (!session && isErpSupabaseConfigured() && !demoMode) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/security/login" element={<SecurityLoginPage />} />
      <Route path="/ceo/visit/:token" element={<CeoVisitMobilePage />} />
      <Route path="/ceo/approve/:token" element={<CeoApprovalPage />} />

      <Route
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="daily-report" element={<DailyReportPage />} />
        <Route path="factory-floor" element={<FactoryFloorPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="looms" element={<LoomsPage />} />
        <Route path="looms/:id" element={<LoomDetailPage />} />
        <Route path="production" element={<ProductionEntriesPage />} />
        <Route path="planning" element={<PlanningPage />} />
        <Route path="targets" element={<TargetsPage />} />
        <Route path="stoppages" element={<StoppagesPage />} />
        <Route path="quality" element={<QualityPage />} />
        <Route path="yarn" element={<YarnPage />} />
        <Route path="beams" element={<BeamsPage />} />
        <Route path="greige" element={<GreigePage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="spares" element={<SparesPage />} />
        <Route path="requisitions" element={<PurchaseRequisitionsPage />} />
        <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="grn" element={<GrnPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="orders" element={<SalesOrdersPage />} />
        <Route path="dispatch" element={<DispatchPage />} />
        <Route path="maintenance/requests" element={<MaintenanceRequestsPage />} />
        <Route path="maintenance/work-orders" element={<WorkOrdersPage />} />
        <Route path="maintenance/pm" element={<PmPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="costing" element={<CostingPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="receivables" element={<ReceivablesPage />} />
        <Route path="payables" element={<PayablesPage />} />

        {/* Existing Security module routes */}
        <Route
          path="security"
          element={
            <SecurityNav>
              {(nav) => <SecurityDashboard onNavigate={nav} />}
            </SecurityNav>
          }
        />
        <Route path="security/visitors" element={<VisitorRequestsPage />} />
        <Route path="security/ceo-visits" element={<CeoVisitRequestsPage />} />
        <Route path="security/gate-pass" element={<GatePassPage />} />
        <Route path="security/inside" element={<VisitorsInsidePage />} />
        <Route path="security/history" element={<VisitorHistoryPage />} />
        <Route path="security/vehicles" element={<VehicleManagementPage />} />
        <Route path="security/material-gate" element={<MaterialGatePage />} />
        <Route path="security/incidents" element={<SecurityIncidentsPage />} />
        <Route path="security/reports" element={<SecurityReportsPage />} />
        <Route path="security/notifications" element={<SecurityNotificationsPage />} />
        <Route path="security/settings" element={<SecuritySettingsPage />} />

        <Route path="reports" element={<ReportsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
