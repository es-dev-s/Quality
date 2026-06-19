import Link from "next/link";
import { CLEAR_SESSION_PATH } from "@/lib/auth-redirects";

export default function AccessDeniedPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__head">
          <div className="login-card__logo">QA</div>
          <h1 className="login-card__title">No access assigned</h1>
          <p className="login-card__subtitle">
            Your account is signed in, but your role does not include access to
            any modules. Ask a super admin to assign a system role (for example
            Agent or Supervisor) or grant permissions to your custom role.
          </p>
        </div>

        <Link href={CLEAR_SESSION_PATH} className="ui-btn ui-btn--primary ui-btn--block">
          Sign out
        </Link>
      </div>
    </div>
  );
}
