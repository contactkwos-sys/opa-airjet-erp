import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { ModuleKey } from "@/lib/permissions";
import { EmptyState } from "@/components/ui";

type Props = {
  module: ModuleKey;
  children: ReactNode;
  action?: "view" | "create" | "edit" | "delete" | "approve" | "export";
};

/** Redirects or blocks when the current role lacks module permission. */
export function ModuleGuard({ module, children, action = "view" }: Props) {
  const { can, loading } = useAuth();

  if (loading) return null;

  if (!can(module, action)) {
    return (
      <EmptyState
        title="Access denied"
        description="You do not have permission to view this module. Contact your administrator."
      />
    );
  }

  return <>{children}</>;
}

/** For use in route definitions — redirects to dashboard. */
export function ModuleRoute({ module, children, action = "view" }: Props) {
  const { can, loading } = useAuth();

  if (loading) return null;
  if (!can(module, action)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
