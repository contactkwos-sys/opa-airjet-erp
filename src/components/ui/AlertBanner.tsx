type Props = {
  tone?: "info" | "success" | "warning" | "danger";
  title: string;
  children?: string;
  onDismiss?: () => void;
};

export function AlertBanner({ tone = "info", title, children, onDismiss }: Props) {
  return (
    <div className={`alert-banner alert-${tone}`} role="status">
      <div>
        <strong>{title}</strong>
        {children ? <p>{children}</p> : null}
      </div>
      {onDismiss ? (
        <button type="button" className="btn btn-ghost" onClick={onDismiss} aria-label="Dismiss">
          ✕
        </button>
      ) : null}
    </div>
  );
}
