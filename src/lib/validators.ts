/** Indian mobile: optional +91 / 0 prefix, then 10 digits starting 6–9 */
export function isValidIndianMobile(value: string): boolean {
  const cleaned = value.replace(/[\s-]/g, "");
  return /^(?:\+91|91|0)?[6-9]\d{9}$/.test(cleaned);
}

export function normalizeIndianMobile(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits.slice(-10);
}

export function required(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return `${label} is required`;
  if (typeof value === "string" && !value.trim()) return `${label} is required`;
  return null;
}

export function validateVisitorForm(input: {
  visitor_name: string;
  company_name: string;
  mobile: string;
  purpose: string;
  person_to_meet: string;
  requested_date: string;
  requested_time: string;
  number_of_visitors: number;
  email?: string;
}): string[] {
  const errors: string[] = [];
  const push = (msg: string | null) => {
    if (msg) errors.push(msg);
  };
  push(required(input.visitor_name, "Visitor name"));
  push(required(input.company_name, "Company name"));
  push(required(input.mobile, "Mobile number"));
  push(required(input.purpose, "Purpose of visit"));
  push(required(input.person_to_meet, "Person to meet"));
  push(required(input.requested_date, "Requested date"));
  push(required(input.requested_time, "Requested time"));
  if (input.mobile && !isValidIndianMobile(input.mobile)) {
    errors.push("Enter a valid Indian mobile number");
  }
  if (input.number_of_visitors < 1 || input.number_of_visitors > 50) {
    errors.push("Number of visitors must be between 1 and 50");
  }
  if (input.email && input.email.trim()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
      errors.push("Enter a valid email address");
    }
  }
  return errors;
}
