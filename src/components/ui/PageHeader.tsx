import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  meta?: ReactNode;
};

export function PageHeader({ title, subtitle, actions, meta }: Props) {
  return (
    <header className="topbar page-header">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p className="subtitle">{subtitle}</p> : null}
      </div>
      <div className="page-header-right">
        {meta}
        {actions ? <div className="page-header-actions">{actions}</div> : null}
      </div>
    </header>
  );
}
