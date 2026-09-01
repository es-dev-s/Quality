-- Store team name on provisioning requests so approved users keep it.
ALTER TABLE "user_provisioning_requests" ADD COLUMN "team_name" TEXT;
