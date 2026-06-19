-- Encrypted copy of passwords for authorized admin reveal (bcrypt remains the login hash).
ALTER TABLE "User" ADD COLUMN "password_encrypted" TEXT;

ALTER TABLE "user_provisioning_requests" ADD COLUMN "password_encrypted" TEXT;
