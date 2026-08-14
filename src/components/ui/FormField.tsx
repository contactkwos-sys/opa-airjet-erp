import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type Base = {
  label: string;
  error?: string;
  hint?: string;
};

export function FormField({
  label,
  error,
  hint,
  children,
}: Base & { children: ReactNode }) {
  return (
    <label className="form-field">
      <span className="form-label">{label}</span>
      {children}
      {hint && !error ? <span className="form-hint">{hint}</span> : null}
      {error ? <span className="form-error">{error}</span> : null}
    </label>
  );
}

export function TextInput({
  label,
  error,
  hint,
  ...props
}: Base & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FormField label={label} error={error} hint={hint}>
      <input className="form-control" {...props} />
    </FormField>
  );
}

export function TextSelect({
  label,
  error,
  hint,
  children,
  ...props
}: Base & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <FormField label={label} error={error} hint={hint}>
      <select className="form-control" {...props}>
        {children}
      </select>
    </FormField>
  );
}

export function TextTextarea({
  label,
  error,
  hint,
  ...props
}: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FormField label={label} error={error} hint={hint}>
      <textarea className="form-control" rows={3} {...props} />
    </FormField>
  );
}
