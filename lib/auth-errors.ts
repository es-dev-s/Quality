export class AccountDeactivatedError extends Error {
  constructor(
    message = "Your account has been deactivated. Contact your administrator."
  ) {
    super(message);
    this.name = "AccountDeactivatedError";
  }
}

export class AccountNotApprovedError extends Error {
  constructor(
    message = "Your account is not approved for login. Contact your Quality Manager."
  ) {
    super(message);
    this.name = "AccountNotApprovedError";
  }
}

export class SessionRevokedError extends Error {
  constructor(message = "Your session has expired. Please sign in again.") {
    super(message);
    this.name = "SessionRevokedError";
  }
}

export function isAuthSessionError(error: unknown): error is Error {
  return (
    error instanceof AccountDeactivatedError ||
    error instanceof AccountNotApprovedError ||
    error instanceof SessionRevokedError ||
    (error instanceof Error &&
      (error.message === "Unauthorized" || error.message === "Forbidden"))
  );
}
