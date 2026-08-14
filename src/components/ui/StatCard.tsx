import type { ReactNode } from "react";

type Props = {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "running" | "stopped" | "breakdown" | "amber" | "sky";
  onClick?: () => void;
};

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  onClick,
}: Props) {
  const toneClass = tone === "default" ? "" : ` ${tone}`;
  return (
    <article
      className={`panel stat${toneClass}${onClick ? " stat-clickable" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
    >
      <span className="label">{label}</span>
      <div className="value">{value}</div>
      {hint ? <div className="hint">{hint}</div> : null}
    </article>
  );
}
