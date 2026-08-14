import { z } from "zod";

/** Common field schemas for forms across the ERP. */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email");

/** Indian mobile: optional +91, then 10 digits starting 6–9 */
export const indianMobileSchema = z
  .string()
  .trim()
  .regex(
    /^(?:\+?91[-\s]?)?[6-9]\d{9}$/,
    "Enter a valid Indian mobile number",
  );

export const optionalIndianMobileSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined))
  .pipe(z.union([indianMobileSchema, z.undefined()]));

export const nonNegativeNumberSchema = z.coerce
  .number({ error: "Must be a number" })
  .finite()
  .nonnegative("Must be zero or greater");

export const positiveNumberSchema = z.coerce
  .number({ error: "Must be a number" })
  .finite()
  .positive("Must be greater than zero");

export const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

export const optionalDateStringSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined))
  .pipe(z.union([dateStringSchema, z.undefined()]));

export const requiredTextSchema = z.string().trim().min(1, "Required");

export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters");

export const loginFormSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const stoppageFormSchema = z.object({
  loom_id: requiredTextSchema,
  reason: requiredTextSchema,
  start_time: requiredTextSchema,
  end_time: z.string().optional(),
  department: z.string().optional(),
  remarks: z.string().optional(),
});

export const qualityFormSchema = z.object({
  inspection_number: requiredTextSchema,
  inspection_date: dateStringSchema,
  result: requiredTextSchema,
  loom_id: z.string().optional(),
  customer_name: z.string().optional(),
  production_lot: z.string().optional(),
  grade: z.string().optional(),
  sample_meters: nonNegativeNumberSchema.optional(),
  meters_checked: nonNegativeNumberSchema.optional(),
  good_meters: nonNegativeNumberSchema.optional(),
  rejected_meters: nonNegativeNumberSchema.optional(),
  defect_type: z.string().optional(),
  defect_quantity: nonNegativeNumberSchema.optional(),
  remarks: z.string().optional(),
});

export const targetFormSchema = z.object({
  target_type: requiredTextSchema,
  target_date: dateStringSchema,
  loom_id: z.string().optional(),
  target_meter: nonNegativeNumberSchema,
  actual_meter: nonNegativeNumberSchema.optional(),
  target_kg: nonNegativeNumberSchema.optional(),
  actual_kg: nonNegativeNumberSchema.optional(),
  remarks: z.string().optional(),
});

export const planFormSchema = z.object({
  plan_number: requiredTextSchema,
  plan_date: dateStringSchema,
  planned_meter: nonNegativeNumberSchema,
  actual_meter: nonNegativeNumberSchema.optional(),
  status: requiredTextSchema,
  remarks: z.string().optional(),
});

export const inventoryItemFormSchema = z.object({
  item_code: requiredTextSchema,
  name: requiredTextSchema,
  category: requiredTextSchema,
  uom: requiredTextSchema,
  reorder_level: nonNegativeNumberSchema.optional(),
  is_active: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
});

export const yarnFormSchema = z.object({
  yarn_code: requiredTextSchema,
  name: requiredTextSchema,
  count: z.string().optional(),
  blend: z.string().optional(),
  color: z.string().optional(),
  supplier_name: z.string().optional(),
  current_qty: nonNegativeNumberSchema.optional(),
  uom: requiredTextSchema,
});

export const beamFormSchema = z.object({
  beam_number: requiredTextSchema,
  status: requiredTextSchema,
  length_meters: nonNegativeNumberSchema,
  remaining_meters: nonNegativeNumberSchema,
  warp_ends: nonNegativeNumberSchema.optional(),
  loom_id: z.string().optional(),
  remarks: z.string().optional(),
});

export const greigeFormSchema = z.object({
  lot_number: requiredTextSchema,
  meters: nonNegativeNumberSchema,
  kg: nonNegativeNumberSchema.optional(),
  quality_grade: requiredTextSchema,
  status: requiredTextSchema,
  remarks: z.string().optional(),
});

export const spareFormSchema = z.object({
  part_code: requiredTextSchema,
  name: requiredTextSchema,
  category: z.string().optional(),
  manufacturer: z.string().optional(),
  current_qty: nonNegativeNumberSchema,
  reorder_level: nonNegativeNumberSchema,
  uom: requiredTextSchema,
});

export const prFormSchema = z.object({
  pr_number: requiredTextSchema,
  request_date: dateStringSchema,
  priority: requiredTextSchema,
  status: requiredTextSchema,
  remarks: z.string().optional(),
});

export const poFormSchema = z.object({
  po_number: requiredTextSchema,
  po_date: dateStringSchema,
  total_amount: nonNegativeNumberSchema,
  currency: z.string().optional(),
  status: requiredTextSchema,
  payment_status: z.string().optional(),
  remarks: z.string().optional(),
});

export const grnFormSchema = z.object({
  grn_number: requiredTextSchema,
  grn_date: dateStringSchema,
  invoice_number: z.string().optional(),
  status: requiredTextSchema,
  remarks: z.string().optional(),
});

export const supplierFormSchema = z.object({
  supplier_code: requiredTextSchema,
  name: requiredTextSchema,
  contact_person: z.string().optional(),
  mobile: optionalIndianMobileSchema,
  email: z.string().optional(),
  city: z.string().optional(),
  gstin: z.string().optional(),
  payment_terms: z.string().optional(),
});

export const customerFormSchema = z.object({
  customer_code: requiredTextSchema,
  name: requiredTextSchema,
  contact_person: z.string().optional(),
  mobile: optionalIndianMobileSchema,
  email: z.string().optional(),
  city: z.string().optional(),
  gstin: z.string().optional(),
  payment_terms: z.string().optional(),
});

export const salesOrderFormSchema = z.object({
  so_number: requiredTextSchema,
  so_date: dateStringSchema,
  total_amount: nonNegativeNumberSchema,
  status: requiredTextSchema,
  payment_status: z.string().optional(),
  remarks: z.string().optional(),
});

export const dispatchFormSchema = z.object({
  dispatch_number: requiredTextSchema,
  dispatch_date: dateStringSchema,
  vehicle_number: requiredTextSchema,
  transporter: z.string().optional(),
  lr_number: z.string().optional(),
  status: requiredTextSchema,
  remarks: z.string().optional(),
});

export const maintRequestFormSchema = z.object({
  request_number: requiredTextSchema,
  issue_type: requiredTextSchema,
  description: requiredTextSchema,
  priority: requiredTextSchema,
  status: requiredTextSchema,
  loom_id: z.string().optional(),
  remarks: z.string().optional(),
});

export const workOrderFormSchema = z.object({
  wo_number: requiredTextSchema,
  work_description: requiredTextSchema,
  priority: requiredTextSchema,
  status: requiredTextSchema,
  labour_hours: nonNegativeNumberSchema.optional(),
  root_cause: z.string().optional(),
  resolution: z.string().optional(),
});

export const pmFormSchema = z.object({
  schedule_code: requiredTextSchema,
  name: requiredTextSchema,
  frequency: requiredTextSchema,
  next_due_date: dateStringSchema,
  estimated_hours: nonNegativeNumberSchema.optional(),
  remarks: z.string().optional(),
});

export const employeeFormSchema = z.object({
  employee_code: requiredTextSchema,
  full_name: requiredTextSchema,
  designation: z.string().optional(),
  department: z.string().optional(),
  mobile: optionalIndianMobileSchema,
  email: z.string().optional(),
  date_of_joining: optionalDateStringSchema,
});

export const attendanceFormSchema = z.object({
  attendance_date: dateStringSchema,
  employee_name: requiredTextSchema,
  status: requiredTextSchema,
  overtime_hours: nonNegativeNumberSchema.optional(),
});

export const costingFormSchema = z.object({
  costing_number: requiredTextSchema,
  entry_date: dateStringSchema,
  yarn_cost: nonNegativeNumberSchema.optional(),
  labour_cost: nonNegativeNumberSchema.optional(),
  power_cost: nonNegativeNumberSchema.optional(),
  overhead_cost: nonNegativeNumberSchema.optional(),
  maintenance_cost: nonNegativeNumberSchema.optional(),
  other_cost: nonNegativeNumberSchema.optional(),
  cost_per_meter: nonNegativeNumberSchema,
  meters: nonNegativeNumberSchema,
  remarks: z.string().optional(),
});

export const visitorFormSchema = z.object({
  visitor_code: requiredTextSchema,
  full_name: requiredTextSchema,
  mobile: optionalIndianMobileSchema,
  company: z.string().optional(),
});

export const ceoVisitFormSchema = z.object({
  request_number: requiredTextSchema,
  visitor_name: requiredTextSchema,
  visitor_mobile: optionalIndianMobileSchema,
  visitor_company: z.string().optional(),
  purpose: requiredTextSchema,
  host_name: z.string().optional(),
  proposed_visit_at: requiredTextSchema,
});

export const gatePassFormSchema = z.object({
  pass_number: requiredTextSchema,
  pass_type: requiredTextSchema,
  purpose: requiredTextSchema,
  status: requiredTextSchema,
});

export const vehicleFormSchema = z.object({
  entry_number: requiredTextSchema,
  vehicle_number: requiredTextSchema,
  driver_name: requiredTextSchema,
  purpose: requiredTextSchema,
  direction: requiredTextSchema,
});

export const materialGateFormSchema = z.object({
  entry_number: requiredTextSchema,
  direction: requiredTextSchema,
  material_description: requiredTextSchema,
  vehicle_number: z.string().optional(),
});

export const incidentFormSchema = z.object({
  incident_number: requiredTextSchema,
  title: requiredTextSchema,
  severity: requiredTextSchema,
  status: requiredTextSchema,
  description: z.string().optional(),
  location: z.string().optional(),
});

export const settingsFormSchema = z.object({
  company_name: requiredTextSchema,
  timezone: requiredTextSchema,
  currency: requiredTextSchema,
  fiscal_year: z.string().optional(),
  loom_count: positiveNumberSchema,
  dobby_count: nonNegativeNumberSchema,
  plain_count: nonNegativeNumberSchema,
  address: z.string().optional(),
});

export const rfqFormSchema = z.object({
  rfq_number: requiredTextSchema,
  rfq_date: dateStringSchema,
  due_date: optionalDateStringSchema,
  status: requiredTextSchema,
  remarks: z.string().optional(),
});

export const quotationFormSchema = z.object({
  quotation_number: requiredTextSchema,
  supplier_name: requiredTextSchema,
  quotation_date: dateStringSchema,
  valid_until: optionalDateStringSchema,
  rate: nonNegativeNumberSchema,
  total_amount: nonNegativeNumberSchema,
  currency: requiredTextSchema,
  status: requiredTextSchema,
  remarks: z.string().optional(),
});

export const rolePermissionFormSchema = z.object({
  role: requiredTextSchema,
  module: requiredTextSchema,
  can_view: z.union([z.boolean(), z.enum(["true", "false"])]),
  can_create: z.union([z.boolean(), z.enum(["true", "false"])]),
  can_edit: z.union([z.boolean(), z.enum(["true", "false"])]),
  can_delete: z.union([z.boolean(), z.enum(["true", "false"])]),
  can_approve: z.union([z.boolean(), z.enum(["true", "false"])]),
  can_export: z.union([z.boolean(), z.enum(["true", "false"])]),
});

/** Flatten zod issues into field → message map */
export function zodFieldErrors(
  error: z.ZodError,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function validateForm<T>(
  schema: z.ZodType<T>,
  values: unknown,
): { data?: T; errors?: Record<string, string> } {
  const parsed = schema.safeParse(values);
  if (parsed.success) return { data: parsed.data };
  return { errors: zodFieldErrors(parsed.error) };
}
