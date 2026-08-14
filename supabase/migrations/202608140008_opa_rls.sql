-- =============================================================================
-- OPA Group of India – Air Jet Loom ERP
-- Migration 008: RLS helpers, role-aware policies, realtime publication
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION opa_current_role()
RETURNS opa_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM opa_profiles
  WHERE id = auth.uid()
    AND is_active = TRUE
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION opa_is_elevated()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    opa_current_role() IN (
      'SUPER_ADMIN'::opa_role,
      'CEO'::opa_role,
      'DIRECTOR'::opa_role,
      'FACTORY_MANAGER'::opa_role
    ),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION opa_has_permission(p_module TEXT, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role opa_role;
  v_ok BOOLEAN := FALSE;
BEGIN
  v_role := opa_current_role();
  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_role = 'SUPER_ADMIN' THEN
    RETURN TRUE;
  END IF;

  SELECT CASE lower(p_action)
    WHEN 'view' THEN can_view
    WHEN 'create' THEN can_create
    WHEN 'edit' THEN can_edit
    WHEN 'delete' THEN can_delete
    WHEN 'approve' THEN can_approve
    WHEN 'export' THEN can_export
    ELSE FALSE
  END
  INTO v_ok
  FROM opa_role_permissions
  WHERE role = v_role
    AND module = p_module
  LIMIT 1;

  RETURN COALESCE(v_ok, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION opa_current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION opa_is_elevated() TO authenticated;
GRANT EXECUTE ON FUNCTION opa_has_permission(TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Policy helper: drop + recreate idempotently
-- ---------------------------------------------------------------------------
-- CORE
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS opa_company_settings_select ON opa_company_settings;
CREATE POLICY opa_company_settings_select ON opa_company_settings
  FOR SELECT TO authenticated
  USING (opa_has_permission('settings', 'view') OR opa_has_permission('dashboard', 'view'));

DROP POLICY IF EXISTS opa_company_settings_write ON opa_company_settings;
CREATE POLICY opa_company_settings_write ON opa_company_settings
  FOR ALL TO authenticated
  USING (opa_has_permission('settings', 'edit'))
  WITH CHECK (opa_has_permission('settings', 'edit'));

DROP POLICY IF EXISTS opa_departments_select ON opa_departments;
CREATE POLICY opa_departments_select ON opa_departments
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS opa_departments_write ON opa_departments;
CREATE POLICY opa_departments_write ON opa_departments
  FOR ALL TO authenticated
  USING (opa_is_elevated() OR opa_has_permission('settings', 'edit'))
  WITH CHECK (opa_is_elevated() OR opa_has_permission('settings', 'edit'));

DROP POLICY IF EXISTS opa_shifts_select ON opa_shifts;
CREATE POLICY opa_shifts_select ON opa_shifts
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS opa_shifts_write ON opa_shifts;
CREATE POLICY opa_shifts_write ON opa_shifts
  FOR ALL TO authenticated
  USING (opa_is_elevated() OR opa_has_permission('settings', 'edit'))
  WITH CHECK (opa_is_elevated() OR opa_has_permission('settings', 'edit'));

DROP POLICY IF EXISTS opa_profiles_select ON opa_profiles;
CREATE POLICY opa_profiles_select ON opa_profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR opa_is_elevated()
    OR opa_has_permission('hr', 'view')
  );

DROP POLICY IF EXISTS opa_profiles_update_self ON opa_profiles;
CREATE POLICY opa_profiles_update_self ON opa_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS opa_profiles_admin ON opa_profiles;
CREATE POLICY opa_profiles_admin ON opa_profiles
  FOR ALL TO authenticated
  USING (opa_is_elevated() OR opa_has_permission('hr', 'edit'))
  WITH CHECK (opa_is_elevated() OR opa_has_permission('hr', 'edit'));

DROP POLICY IF EXISTS opa_role_permissions_select ON opa_role_permissions;
CREATE POLICY opa_role_permissions_select ON opa_role_permissions
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS opa_role_permissions_write ON opa_role_permissions;
CREATE POLICY opa_role_permissions_write ON opa_role_permissions
  FOR ALL TO authenticated
  USING (opa_current_role() = 'SUPER_ADMIN')
  WITH CHECK (opa_current_role() = 'SUPER_ADMIN');

-- Audit: insert + select only (no update/delete for normal users)
DROP POLICY IF EXISTS opa_audit_logs_select ON opa_audit_logs;
CREATE POLICY opa_audit_logs_select ON opa_audit_logs
  FOR SELECT TO authenticated
  USING (opa_has_permission('audit', 'view') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_audit_logs_insert ON opa_audit_logs;
CREATE POLICY opa_audit_logs_insert ON opa_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Intentionally no UPDATE/DELETE policies on opa_audit_logs for authenticated

DROP POLICY IF EXISTS opa_notifications_select ON opa_notifications;
CREATE POLICY opa_notifications_select ON opa_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR opa_is_elevated());

DROP POLICY IF EXISTS opa_notifications_update ON opa_notifications;
CREATE POLICY opa_notifications_update ON opa_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR opa_is_elevated())
  WITH CHECK (user_id = auth.uid() OR opa_is_elevated());

DROP POLICY IF EXISTS opa_notifications_insert ON opa_notifications;
CREATE POLICY opa_notifications_insert ON opa_notifications
  FOR INSERT TO authenticated
  WITH CHECK (opa_is_elevated() OR user_id = auth.uid());

DROP POLICY IF EXISTS opa_documents_all ON opa_documents;
CREATE POLICY opa_documents_all ON opa_documents
  FOR ALL TO authenticated
  USING (opa_has_permission('documents', 'view') OR opa_is_elevated())
  WITH CHECK (
    opa_has_permission('documents', 'create')
    OR opa_has_permission('documents', 'edit')
    OR opa_is_elevated()
  );

DROP POLICY IF EXISTS opa_approvals_select ON opa_approvals;
CREATE POLICY opa_approvals_select ON opa_approvals
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR reviewed_by = auth.uid()
    OR opa_has_permission('approvals', 'view')
    OR opa_is_elevated()
  );

DROP POLICY IF EXISTS opa_approvals_write ON opa_approvals;
CREATE POLICY opa_approvals_write ON opa_approvals
  FOR ALL TO authenticated
  USING (
    opa_has_permission('approvals', 'edit')
    OR opa_has_permission('approvals', 'approve')
    OR opa_is_elevated()
  )
  WITH CHECK (
    opa_has_permission('approvals', 'create')
    OR opa_has_permission('approvals', 'approve')
    OR opa_is_elevated()
  );

DROP POLICY IF EXISTS opa_alerts_select ON opa_alerts;
CREATE POLICY opa_alerts_select ON opa_alerts
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS opa_alerts_write ON opa_alerts;
CREATE POLICY opa_alerts_write ON opa_alerts
  FOR ALL TO authenticated
  USING (opa_is_elevated() OR opa_has_permission('dashboard', 'edit'))
  WITH CHECK (opa_is_elevated() OR opa_has_permission('dashboard', 'edit'));

-- ---------------------------------------------------------------------------
-- PRODUCTION
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS opa_looms_select ON opa_looms;
CREATE POLICY opa_looms_select ON opa_looms
  FOR SELECT TO authenticated
  USING (opa_has_permission('looms', 'view') OR opa_has_permission('production', 'view') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_looms_write ON opa_looms;
CREATE POLICY opa_looms_write ON opa_looms
  FOR ALL TO authenticated
  USING (opa_has_permission('looms', 'edit') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('looms', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_articles_all ON opa_articles;
CREATE POLICY opa_articles_all ON opa_articles
  FOR ALL TO authenticated
  USING (opa_has_permission('production', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('production', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_production_plans_all ON opa_production_plans;
CREATE POLICY opa_production_plans_all ON opa_production_plans
  FOR ALL TO authenticated
  USING (opa_has_permission('production', 'view') OR opa_is_elevated())
  WITH CHECK (
    opa_has_permission('production', 'create')
    OR opa_has_permission('production', 'edit')
    OR opa_is_elevated()
  );

DROP POLICY IF EXISTS opa_production_entries_all ON opa_production_entries;
CREATE POLICY opa_production_entries_all ON opa_production_entries
  FOR ALL TO authenticated
  USING (opa_has_permission('production', 'view') OR opa_is_elevated())
  WITH CHECK (
    opa_has_permission('production', 'create')
    OR opa_has_permission('production', 'edit')
    OR opa_is_elevated()
  );

DROP POLICY IF EXISTS opa_production_targets_all ON opa_production_targets;
CREATE POLICY opa_production_targets_all ON opa_production_targets
  FOR ALL TO authenticated
  USING (opa_has_permission('production', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('production', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_loom_stoppages_all ON opa_loom_stoppages;
CREATE POLICY opa_loom_stoppages_all ON opa_loom_stoppages
  FOR ALL TO authenticated
  USING (
    opa_has_permission('production', 'view')
    OR opa_has_permission('maintenance', 'view')
    OR opa_is_elevated()
  )
  WITH CHECK (
    opa_has_permission('production', 'create')
    OR opa_has_permission('maintenance', 'create')
    OR opa_is_elevated()
  );

DROP POLICY IF EXISTS opa_quality_inspections_all ON opa_quality_inspections;
CREATE POLICY opa_quality_inspections_all ON opa_quality_inspections
  FOR ALL TO authenticated
  USING (opa_has_permission('quality', 'view') OR opa_is_elevated())
  WITH CHECK (
    opa_has_permission('quality', 'create')
    OR opa_has_permission('quality', 'edit')
    OR opa_is_elevated()
  );

DROP POLICY IF EXISTS opa_quality_defects_all ON opa_quality_defects;
CREATE POLICY opa_quality_defects_all ON opa_quality_defects
  FOR ALL TO authenticated
  USING (opa_has_permission('quality', 'view') OR opa_is_elevated())
  WITH CHECK (
    opa_has_permission('quality', 'create')
    OR opa_has_permission('quality', 'edit')
    OR opa_is_elevated()
  );

-- ---------------------------------------------------------------------------
-- INVENTORY
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS opa_stores_all ON opa_stores;
CREATE POLICY opa_stores_all ON opa_stores
  FOR ALL TO authenticated
  USING (opa_has_permission('inventory', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('inventory', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_inventory_items_all ON opa_inventory_items;
CREATE POLICY opa_inventory_items_all ON opa_inventory_items
  FOR ALL TO authenticated
  USING (opa_has_permission('inventory', 'view') OR opa_is_elevated())
  WITH CHECK (
    opa_has_permission('inventory', 'create')
    OR opa_has_permission('inventory', 'edit')
    OR opa_is_elevated()
  );

DROP POLICY IF EXISTS opa_stock_movements_all ON opa_stock_movements;
CREATE POLICY opa_stock_movements_all ON opa_stock_movements
  FOR ALL TO authenticated
  USING (opa_has_permission('inventory', 'view') OR opa_is_elevated())
  WITH CHECK (
    opa_has_permission('inventory', 'create')
    OR opa_has_permission('inventory', 'edit')
    OR opa_is_elevated()
  );

DROP POLICY IF EXISTS opa_yarn_master_all ON opa_yarn_master;
CREATE POLICY opa_yarn_master_all ON opa_yarn_master
  FOR ALL TO authenticated
  USING (opa_has_permission('yarn', 'view') OR opa_has_permission('inventory', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('yarn', 'edit') OR opa_has_permission('inventory', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_yarn_transactions_all ON opa_yarn_transactions;
CREATE POLICY opa_yarn_transactions_all ON opa_yarn_transactions
  FOR ALL TO authenticated
  USING (opa_has_permission('yarn', 'view') OR opa_has_permission('inventory', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('yarn', 'create') OR opa_has_permission('inventory', 'create') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_beams_all ON opa_beams;
CREATE POLICY opa_beams_all ON opa_beams
  FOR ALL TO authenticated
  USING (
    opa_has_permission('yarn', 'view')
    OR opa_has_permission('production', 'view')
    OR opa_is_elevated()
  )
  WITH CHECK (
    opa_has_permission('yarn', 'edit')
    OR opa_has_permission('production', 'edit')
    OR opa_is_elevated()
  );

DROP POLICY IF EXISTS opa_greige_stock_all ON opa_greige_stock;
CREATE POLICY opa_greige_stock_all ON opa_greige_stock
  FOR ALL TO authenticated
  USING (opa_has_permission('inventory', 'view') OR opa_has_permission('production', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('inventory', 'edit') OR opa_has_permission('production', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_greige_movements_all ON opa_greige_movements;
CREATE POLICY opa_greige_movements_all ON opa_greige_movements
  FOR ALL TO authenticated
  USING (opa_has_permission('inventory', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('inventory', 'create') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_spare_parts_all ON opa_spare_parts;
CREATE POLICY opa_spare_parts_all ON opa_spare_parts
  FOR ALL TO authenticated
  USING (
    opa_has_permission('inventory', 'view')
    OR opa_has_permission('maintenance', 'view')
    OR opa_is_elevated()
  )
  WITH CHECK (
    opa_has_permission('inventory', 'edit')
    OR opa_has_permission('maintenance', 'edit')
    OR opa_is_elevated()
  );

-- ---------------------------------------------------------------------------
-- PURCHASE & SALES
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS opa_suppliers_all ON opa_suppliers;
CREATE POLICY opa_suppliers_all ON opa_suppliers
  FOR ALL TO authenticated
  USING (opa_has_permission('purchase', 'view') OR opa_has_permission('accounts', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('purchase', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_supplier_transactions_all ON opa_supplier_transactions;
CREATE POLICY opa_supplier_transactions_all ON opa_supplier_transactions
  FOR ALL TO authenticated
  USING (opa_has_permission('purchase', 'view') OR opa_has_permission('accounts', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('accounts', 'create') OR opa_has_permission('purchase', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_purchase_requisitions_all ON opa_purchase_requisitions;
CREATE POLICY opa_purchase_requisitions_all ON opa_purchase_requisitions
  FOR ALL TO authenticated
  USING (opa_has_permission('purchase', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('purchase', 'create') OR opa_has_permission('purchase', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_purchase_requisition_items_all ON opa_purchase_requisition_items;
CREATE POLICY opa_purchase_requisition_items_all ON opa_purchase_requisition_items
  FOR ALL TO authenticated
  USING (opa_has_permission('purchase', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('purchase', 'create') OR opa_has_permission('purchase', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_rfqs_all ON opa_rfqs;
CREATE POLICY opa_rfqs_all ON opa_rfqs
  FOR ALL TO authenticated
  USING (opa_has_permission('purchase', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('purchase', 'create') OR opa_has_permission('purchase', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_supplier_quotations_all ON opa_supplier_quotations;
CREATE POLICY opa_supplier_quotations_all ON opa_supplier_quotations
  FOR ALL TO authenticated
  USING (opa_has_permission('purchase', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('purchase', 'create') OR opa_has_permission('purchase', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_quotation_items_all ON opa_quotation_items;
CREATE POLICY opa_quotation_items_all ON opa_quotation_items
  FOR ALL TO authenticated
  USING (opa_has_permission('purchase', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('purchase', 'create') OR opa_has_permission('purchase', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_purchase_orders_all ON opa_purchase_orders;
CREATE POLICY opa_purchase_orders_all ON opa_purchase_orders
  FOR ALL TO authenticated
  USING (opa_has_permission('purchase', 'view') OR opa_has_permission('accounts', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('purchase', 'create') OR opa_has_permission('purchase', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_purchase_order_items_all ON opa_purchase_order_items;
CREATE POLICY opa_purchase_order_items_all ON opa_purchase_order_items
  FOR ALL TO authenticated
  USING (opa_has_permission('purchase', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('purchase', 'create') OR opa_has_permission('purchase', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_grns_all ON opa_grns;
CREATE POLICY opa_grns_all ON opa_grns
  FOR ALL TO authenticated
  USING (opa_has_permission('purchase', 'view') OR opa_has_permission('inventory', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('purchase', 'create') OR opa_has_permission('inventory', 'create') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_grn_items_all ON opa_grn_items;
CREATE POLICY opa_grn_items_all ON opa_grn_items
  FOR ALL TO authenticated
  USING (opa_has_permission('purchase', 'view') OR opa_has_permission('inventory', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('purchase', 'create') OR opa_has_permission('inventory', 'create') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_customers_all ON opa_customers;
CREATE POLICY opa_customers_all ON opa_customers
  FOR ALL TO authenticated
  USING (opa_has_permission('sales', 'view') OR opa_has_permission('accounts', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('sales', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_sales_orders_all ON opa_sales_orders;
CREATE POLICY opa_sales_orders_all ON opa_sales_orders
  FOR ALL TO authenticated
  USING (opa_has_permission('sales', 'view') OR opa_has_permission('accounts', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('sales', 'create') OR opa_has_permission('sales', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_sales_order_items_all ON opa_sales_order_items;
CREATE POLICY opa_sales_order_items_all ON opa_sales_order_items
  FOR ALL TO authenticated
  USING (opa_has_permission('sales', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('sales', 'create') OR opa_has_permission('sales', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_dispatches_all ON opa_dispatches;
CREATE POLICY opa_dispatches_all ON opa_dispatches
  FOR ALL TO authenticated
  USING (opa_has_permission('sales', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('sales', 'create') OR opa_has_permission('sales', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_dispatch_items_all ON opa_dispatch_items;
CREATE POLICY opa_dispatch_items_all ON opa_dispatch_items
  FOR ALL TO authenticated
  USING (opa_has_permission('sales', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('sales', 'create') OR opa_has_permission('sales', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_payments_all ON opa_payments;
CREATE POLICY opa_payments_all ON opa_payments
  FOR ALL TO authenticated
  USING (opa_has_permission('accounts', 'view') OR opa_has_permission('purchase', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('accounts', 'create') OR opa_has_permission('accounts', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_receipts_all ON opa_receipts;
CREATE POLICY opa_receipts_all ON opa_receipts
  FOR ALL TO authenticated
  USING (opa_has_permission('accounts', 'view') OR opa_has_permission('sales', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('accounts', 'create') OR opa_has_permission('accounts', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_costing_entries_all ON opa_costing_entries;
CREATE POLICY opa_costing_entries_all ON opa_costing_entries
  FOR ALL TO authenticated
  USING (opa_has_permission('costing', 'view') OR opa_has_permission('accounts', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('costing', 'create') OR opa_has_permission('accounts', 'edit') OR opa_is_elevated());

-- ---------------------------------------------------------------------------
-- MAINTENANCE & HR
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS opa_maintenance_requests_all ON opa_maintenance_requests;
CREATE POLICY opa_maintenance_requests_all ON opa_maintenance_requests
  FOR ALL TO authenticated
  USING (
    opa_has_permission('maintenance', 'view')
    OR opa_has_permission('production', 'view')
    OR opa_is_elevated()
  )
  WITH CHECK (
    opa_has_permission('maintenance', 'create')
    OR opa_has_permission('production', 'create')
    OR opa_is_elevated()
  );

DROP POLICY IF EXISTS opa_maintenance_work_orders_all ON opa_maintenance_work_orders;
CREATE POLICY opa_maintenance_work_orders_all ON opa_maintenance_work_orders
  FOR ALL TO authenticated
  USING (opa_has_permission('maintenance', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('maintenance', 'create') OR opa_has_permission('maintenance', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_maintenance_spare_usage_all ON opa_maintenance_spare_usage;
CREATE POLICY opa_maintenance_spare_usage_all ON opa_maintenance_spare_usage
  FOR ALL TO authenticated
  USING (opa_has_permission('maintenance', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('maintenance', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_pm_schedules_all ON opa_pm_schedules;
CREATE POLICY opa_pm_schedules_all ON opa_pm_schedules
  FOR ALL TO authenticated
  USING (opa_has_permission('maintenance', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('maintenance', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_pm_checklists_all ON opa_pm_checklists;
CREATE POLICY opa_pm_checklists_all ON opa_pm_checklists
  FOR ALL TO authenticated
  USING (opa_has_permission('maintenance', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('maintenance', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_pm_completions_all ON opa_pm_completions;
CREATE POLICY opa_pm_completions_all ON opa_pm_completions
  FOR ALL TO authenticated
  USING (opa_has_permission('maintenance', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('maintenance', 'create') OR opa_has_permission('maintenance', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_employees_all ON opa_employees;
CREATE POLICY opa_employees_all ON opa_employees
  FOR ALL TO authenticated
  USING (opa_has_permission('hr', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('hr', 'create') OR opa_has_permission('hr', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_attendance_all ON opa_attendance;
CREATE POLICY opa_attendance_all ON opa_attendance
  FOR ALL TO authenticated
  USING (opa_has_permission('hr', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('hr', 'create') OR opa_has_permission('hr', 'edit') OR opa_is_elevated());

-- ---------------------------------------------------------------------------
-- SECURITY
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS opa_visitors_all ON opa_visitors;
CREATE POLICY opa_visitors_all ON opa_visitors
  FOR ALL TO authenticated
  USING (opa_has_permission('security', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('security', 'create') OR opa_has_permission('security', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_ceo_visit_requests_select ON opa_ceo_visit_requests;
CREATE POLICY opa_ceo_visit_requests_select ON opa_ceo_visit_requests
  FOR SELECT TO authenticated
  USING (
    opa_has_permission('security', 'view')
    OR opa_current_role() IN ('CEO'::opa_role, 'DIRECTOR'::opa_role, 'SUPER_ADMIN'::opa_role)
    OR requested_by = auth.uid()
    OR opa_is_elevated()
  );

DROP POLICY IF EXISTS opa_ceo_visit_requests_write ON opa_ceo_visit_requests;
CREATE POLICY opa_ceo_visit_requests_write ON opa_ceo_visit_requests
  FOR ALL TO authenticated
  USING (
    opa_has_permission('security', 'edit')
    OR opa_current_role() IN ('CEO'::opa_role, 'SUPER_ADMIN'::opa_role)
    OR opa_is_elevated()
  )
  WITH CHECK (
    opa_has_permission('security', 'create')
    OR opa_has_permission('security', 'edit')
    OR opa_current_role() IN ('CEO'::opa_role, 'SUPER_ADMIN'::opa_role)
    OR opa_is_elevated()
  );

DROP POLICY IF EXISTS opa_gate_passes_all ON opa_gate_passes;
CREATE POLICY opa_gate_passes_all ON opa_gate_passes
  FOR ALL TO authenticated
  USING (opa_has_permission('security', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('security', 'create') OR opa_has_permission('security', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_visitor_checkins_all ON opa_visitor_checkins;
CREATE POLICY opa_visitor_checkins_all ON opa_visitor_checkins
  FOR ALL TO authenticated
  USING (opa_has_permission('security', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('security', 'create') OR opa_has_permission('security', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_vehicle_entries_all ON opa_vehicle_entries;
CREATE POLICY opa_vehicle_entries_all ON opa_vehicle_entries
  FOR ALL TO authenticated
  USING (opa_has_permission('security', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('security', 'create') OR opa_has_permission('security', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_material_gate_entries_all ON opa_material_gate_entries;
CREATE POLICY opa_material_gate_entries_all ON opa_material_gate_entries
  FOR ALL TO authenticated
  USING (opa_has_permission('security', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('security', 'create') OR opa_has_permission('security', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_security_incidents_all ON opa_security_incidents;
CREATE POLICY opa_security_incidents_all ON opa_security_incidents
  FOR ALL TO authenticated
  USING (opa_has_permission('security', 'view') OR opa_is_elevated())
  WITH CHECK (opa_has_permission('security', 'create') OR opa_has_permission('security', 'edit') OR opa_is_elevated());

DROP POLICY IF EXISTS opa_whatsapp_outbox_select ON opa_whatsapp_outbox;
CREATE POLICY opa_whatsapp_outbox_select ON opa_whatsapp_outbox
  FOR SELECT TO authenticated
  USING (opa_is_elevated() OR opa_current_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS opa_whatsapp_outbox_service ON opa_whatsapp_outbox;
CREATE POLICY opa_whatsapp_outbox_service ON opa_whatsapp_outbox
  FOR ALL TO authenticated
  USING (opa_current_role() = 'SUPER_ADMIN')
  WITH CHECK (opa_current_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS opa_whatsapp_webhooks_select ON opa_whatsapp_webhooks;
CREATE POLICY opa_whatsapp_webhooks_select ON opa_whatsapp_webhooks
  FOR SELECT TO authenticated
  USING (opa_current_role() = 'SUPER_ADMIN' OR opa_is_elevated());

DROP POLICY IF EXISTS opa_whatsapp_webhooks_insert ON opa_whatsapp_webhooks;
CREATE POLICY opa_whatsapp_webhooks_insert ON opa_whatsapp_webhooks
  FOR INSERT TO authenticated
  WITH CHECK (opa_current_role() = 'SUPER_ADMIN');

-- Service role bypasses RLS by default in Supabase.

-- ---------------------------------------------------------------------------
-- Realtime publication for key operational tables
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'opa_looms',
    'opa_production_entries',
    'opa_loom_stoppages',
    'opa_alerts',
    'opa_notifications',
    'opa_maintenance_requests',
    'opa_maintenance_work_orders',
    'opa_ceo_visit_requests',
    'opa_approvals',
    'opa_whatsapp_outbox'
  ];
BEGIN
  BEGIN
    CREATE PUBLICATION opa_realtime;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION opa_realtime ADD TABLE %I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    WHEN undefined_table THEN
      NULL;
    END;
  END LOOP;
END $$;
