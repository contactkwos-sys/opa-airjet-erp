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
