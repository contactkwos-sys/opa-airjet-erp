import type { ReactNode } from "react";

const toneClass: Record<string, string> = {
  running: "badge running",
  RUNNING: "badge running",
  stopped: "badge stopped",
  STOPPED: "badge stopped",
  breakdown: "badge breakdown",
  BREAKDOWN: "badge breakdown",
  MAINTENANCE: "badge stopped",
  IDLE: "badge stopped",
  success: "badge running",
  warning: "badge stopped",
  danger: "badge breakdown",
  info: "badge info",
  PENDING: "badge stopped",
  APPROVED: "badge running",
  REJECTED: "badge breakdown",
  OPEN: "badge stopped",
  COMPLETED: "badge running",
  DRAFT: "badge info",
};

type Props = {
  status: string;
  children?: ReactNode;
  className?: string;
};

export function StatusBadge({ status, children, className }: Props) {
  const cls = toneClass[status] ?? "badge info";
  return (
    <span className={`${cls}${className ? ` ${className}` : ""}`}>
      {children ?? status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}
