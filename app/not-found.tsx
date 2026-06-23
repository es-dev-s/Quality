import Link from "next/link";

export default function NotFound() {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__head">
          <div className="login-card__logo">QA</div>
          <h1 className="login-card__title">Page not found</h1>
          <p className="login-card__subtitle">
            The page you requested does not exist or may have been moved.
          </p>
        </div>
        <Link href="/audit-logs" className="ui-btn ui-btn--primary ui-btn--block">
          Go to audit logs
        </Link>
      </div>
    </div>
  );
}
