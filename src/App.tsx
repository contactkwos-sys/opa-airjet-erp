import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import { LoadingState } from "@/components/ui";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import LoomsPage from "@/pages/LoomsPage";
import LoomDetailPage from "@/pages/LoomDetailPage";
import ProductionEntriesPage from "@/pages/ProductionEntriesPage";
import FactoryFloorPage from "@/pages/FactoryFloorPage";
import CeoVisitMobilePage from "@/pages/ceo/CeoVisitMobilePage";
import DailyReportPage from "@/pages/DailyReportPage";
import AlertsPage from "@/pages/AlertsPage";
import PlanningPage from "@/pages/PlanningPage";
import TargetsPage from "@/pages/TargetsPage";
import StoppagesPage from "@/pages/StoppagesPage";
import QualityPage from "@/pages/QualityPage";
import YarnPage from "@/pages/YarnPage";
import BeamsPage from "@/pages/BeamsPage";
import GreigePage from "@/pages/GreigePage";
import InventoryPage from "@/pages/InventoryPage";
import SparesPage from "@/pages/SparesPage";
import RequisitionsPage from "@/pages/RequisitionsPage";
import PurchaseOrdersPage from "@/pages/PurchaseOrdersPage";
import GrnPage from "@/pages/GrnPage";
import SuppliersPage from "@/pages/SuppliersPage";
import CustomersPage from "@/pages/CustomersPage";
import SalesOrdersPage from "@/pages/SalesOrdersPage";
import DispatchPage from "@/pages/DispatchPage";
import RequestsPage from "@/pages/maintenance/RequestsPage";
import WorkOrdersPage from "@/pages/maintenance/WorkOrdersPage";
import PmPage from "@/pages/maintenance/PmPage";
import EmployeesPage from "@/pages/EmployeesPage";
import AttendancePage from "@/pages/AttendancePage";
import CostingPage from "@/pages/CostingPage";
import ReceivablesPage from "@/pages/ReceivablesPage";
import PayablesPage from "@/pages/PayablesPage";
import VisitorsPage from "@/pages/security/VisitorsPage";
import CeoVisitsPage from "@/pages/security/CeoVisitsPage";
import GatePassPage from "@/pages/security/GatePassPage";
import VehiclesPage from "@/pages/security/VehiclesPage";
import MaterialGatePage from "@/pages/security/MaterialGatePage";
import IncidentsPage from "@/pages/security/IncidentsPage";
import ReportsPage from "@/pages/ReportsPage";
import NotificationsPage from "@/pages/NotificationsPage";
import ApprovalsPage from "@/pages/ApprovalsPage";
import DocumentsPage from "@/pages/DocumentsPage";
import SearchPage from "@/pages/SearchPage";
import SettingsPage from "@/pages/SettingsPage";
import AuditPage from "@/pages/AuditPage";
import { isSupabaseConfigured } from "@/lib/env";

function Protected({ children }: { children: ReactNode }) {
  const { session, loading, demoMode } = useAuth();
  if (loading) return <LoadingState label="Starting OPA ERP…" />;
  // Allow app when Demo Mode or authenticated session
  if (!session && isSupabaseConfigured() && !demoMode) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/ceo/visit/:token" element={<CeoVisitMobilePage />} />
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
        <Route path="requisitions" element={<RequisitionsPage />} />
        <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="grn" element={<GrnPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="orders" element={<SalesOrdersPage />} />
        <Route path="dispatch" element={<DispatchPage />} />
        <Route path="maintenance/requests" element={<RequestsPage />} />
        <Route path="maintenance/work-orders" element={<WorkOrdersPage />} />
        <Route path="maintenance/pm" element={<PmPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="costing" element={<CostingPage />} />
        <Route path="receivables" element={<ReceivablesPage />} />
        <Route path="payables" element={<PayablesPage />} />
        <Route path="security/visitors" element={<VisitorsPage />} />
        <Route path="security/ceo-visits" element={<CeoVisitsPage />} />
        <Route path="security/gate-pass" element={<GatePassPage />} />
        <Route path="security/vehicles" element={<VehiclesPage />} />
        <Route path="security/material-gate" element={<MaterialGatePage />} />
        <Route path="security/incidents" element={<IncidentsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
