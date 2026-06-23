/**
 * Session lifecycle checks for deactivate/activate flows.
 * Run: npx tsx scripts/verify-session-lifecycle.ts
 */
import {
  invalidSessionRedirectReason,
  validateSessionAgainstUser,
} from "@/lib/auth-session-policy";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function testActiveUserWithMatchingSession() {
  assert(
    validateSessionAgainstUser({ sessionVersion: 3 }, {
      isActive: true,
      approvalStatus: "ACTIVE",
      sessionVersion: 3,
    }) === null,
    "Matching session version should pass validation"
  );
}

function testDeactivatedUserSession() {
  assert(
    validateSessionAgainstUser({ sessionVersion: 3 }, {
      isActive: false,
      approvalStatus: "ACTIVE",
      sessionVersion: 4,
    }) === "inactive",
    "Inactive users should fail before session version check"
  );
}

function testRevokedSessionAfterDeactivate() {
  assert(
    validateSessionAgainstUser({ sessionVersion: 2 }, {
      isActive: true,
      approvalStatus: "ACTIVE",
      sessionVersion: 3,
    }) === "session_revoked",
    "Stale JWT after deactivate should be rejected"
  );
}

function testReactivatedUserCanUseFreshSession() {
  assert(
    validateSessionAgainstUser({ sessionVersion: 3 }, {
      isActive: true,
      approvalStatus: "ACTIVE",
      sessionVersion: 3,
    }) === null,
    "Reactivated user with fresh login token should pass validation"
  );
}

function testRedirectReasons() {
  assert(
    invalidSessionRedirectReason("inactive") === "deactivated",
    "Inactive users should redirect with deactivated reason"
  );
  assert(
    invalidSessionRedirectReason("session_revoked") === "session",
    "Revoked sessions should redirect with session reason"
  );
  assert(
    invalidSessionRedirectReason("not_approved") === "not_approved",
    "Unapproved users should redirect with not_approved reason"
  );
}

function main() {
  testActiveUserWithMatchingSession();
  testDeactivatedUserSession();
  testRevokedSessionAfterDeactivate();
  testReactivatedUserCanUseFreshSession();
  testRedirectReasons();
  console.log("verify-session-lifecycle: OK");
}

main();
