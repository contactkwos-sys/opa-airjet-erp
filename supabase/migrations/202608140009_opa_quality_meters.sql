-- =============================================================================
-- OPA ERP — non-destructive quality field extensions (IF NOT EXISTS)
-- Adds meters checked / good / rejected for Quality Management reporting.
-- Does NOT drop or alter existing Security tables.
-- =============================================================================

ALTER TABLE opa_quality_inspections
  ADD COLUMN IF NOT EXISTS meters_checked NUMERIC(14, 3),
  ADD COLUMN IF NOT EXISTS good_meters NUMERIC(14, 3),
  ADD COLUMN IF NOT EXISTS rejected_meters NUMERIC(14, 3),
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS production_lot TEXT,
  ADD COLUMN IF NOT EXISTS defect_type TEXT,
  ADD COLUMN IF NOT EXISTS defect_quantity NUMERIC(14, 3);

COMMENT ON COLUMN opa_quality_inspections.meters_checked IS 'Meters inspected';
COMMENT ON COLUMN opa_quality_inspections.good_meters IS 'Accepted meters';
COMMENT ON COLUMN opa_quality_inspections.rejected_meters IS 'Rejected meters';
