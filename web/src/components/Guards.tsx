// Encaminha o utilizador conforme a sessão, o papel, o MFA e o consentimento (lib/access.ts).
import { Navigate, Outlet, useLocation } from "react-router";
import { type Area, decideAccess, ROUTES } from "../lib/access";
import { useAuth } from "../lib/AuthProvider";
import { Spinner } from "./ui";

export function RequireArea({ area }: { area: Area }) {
  const { ready, session, context, contextLoading, aal } = useAuth();
  const location = useLocation();
  if (!ready || contextLoading) return <Spinner fullScreen />;

  const decision = decideAccess(area, { hasSession: !!session, context, aal });
  const next = encodeURIComponent(location.pathname + location.search);
  switch (decision.kind) {
    case "ok":
      return <Outlet />;
    case "login":
      return <Navigate to={`${area === "staff" ? ROUTES.teamLogin : ROUTES.clientLogin}?next=${next}`} replace />;
    case "mfa":
      return <Navigate to={`${ROUTES.mfa}?next=${next}`} replace />;
    case "consent":
    case "notice_missing":
      return <Navigate to={ROUTES.privacy} replace />;
    case "no_access":
      return <Navigate to={ROUTES.noAccess} replace />;
    case "redirect":
      return <Navigate to={decision.to} replace />;
  }
}
