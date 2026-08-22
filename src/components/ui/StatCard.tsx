import type { KeyboardEvent, ReactNode } from "react";
import { Link } from "react-router-dom";

type Props = {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "running" | "stopped" | "breakdown" | "amber" | "sky";
  /** Navigate to this route when the card is activated. */
  to?: string;
  onClick?: () => void;
};

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  to,
  onClick,
}: Props) {
  const toneClass = tone === "default" ? "" : ` ${tone}`;
  const clickable = Boolean(to || onClick);
  const className = `panel stat${toneClass}${clickable ? " stat-clickable" : ""}`;

  const body = (
    <>
      <span className="label">{label}</span>
      <div className="value">{value}</div>
      {hint ? <div className="hint">{hint}</div> : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className} aria-label={`${label} — open details`}>
        {body}
      </Link>
    );
  }

  const onKeyDown = onClick
    ? (e: KeyboardEvent<HTMLElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }
    : undefined;

  return (
    <article
      className={className}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onKeyDown}
    >
      {body}
    </article>
  );
}
