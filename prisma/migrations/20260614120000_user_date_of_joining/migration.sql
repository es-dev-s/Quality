-- Add optional joining date for platform users (required in UI for Agent role).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "date_of_joining" TEXT;
