-- COMPANY_ADMIN must be committed before any later statement uses the value.
-- Keep this migration as its own file / transaction.
ALTER TYPE opa_role ADD VALUE IF NOT EXISTS 'COMPANY_ADMIN';
