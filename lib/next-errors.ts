/** Next.js `redirect()` / `notFound()` throw special errors — never swallow them. */

export function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export function isNextNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_NOT_FOUND")
  );
}

export function rethrowNextNavigation(error: unknown): void {
  if (isNextRedirectError(error) || isNextNotFoundError(error)) {
    throw error;
  }
}
