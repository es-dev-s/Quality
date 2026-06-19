CREATE UNIQUE INDEX IF NOT EXISTS "user_provisioning_requests_pending_email_key"
ON "user_provisioning_requests" ("email")
WHERE "status" = 'PENDING';
