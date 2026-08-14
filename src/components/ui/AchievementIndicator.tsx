export type AchievementLevel = "red" | "amber" | "green";

type Props = {
  level: AchievementLevel;
  label?: string;
  value?: string | number;
};

const labels: Record<AchievementLevel, string> = {
  red: "Below target",
  amber: "Near target",
  green: "On track",
};

export function AchievementIndicator({ level, label, value }: Props) {
  return (
    <div className={`achievement achievement-${level}`}>
      <span className="achievement-dot" aria-hidden />
      <div>
        <div className="achievement-label">{label ?? labels[level]}</div>
        {value !== undefined ? (
          <div className="achievement-value">{value}</div>
        ) : null}
      </div>
    </div>
  );
}

/** Map efficiency / achievement % to traffic-light. */
export function efficiencyLevel(pct: number): AchievementLevel {
  if (pct >= 90) return "green";
  if (pct >= 75) return "amber";
  return "red";
}

/** Convenience: render achievement from a percentage value. */
export function AchievementPct({ value }: { value: number }) {
  const level = efficiencyLevel(value);
  return <AchievementIndicator level={level} value={`${value}%`} label={`${value}%`} />;
}
