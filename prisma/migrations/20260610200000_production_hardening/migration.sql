-- SystemMeta for one-time seed flags and platform state
CREATE TABLE "system_meta" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_meta_pkey" PRIMARY KEY ("key")
);

-- Case-insensitive agent name uniqueness
ALTER TABLE "agents" ADD COLUMN "name_key" TEXT;

UPDATE "agents" SET "name_key" = LOWER(TRIM("name")) WHERE "name_key" IS NULL;

ALTER TABLE "agents" ALTER COLUMN "name_key" SET NOT NULL;

CREATE UNIQUE INDEX "agents_name_key_key" ON "agents"("name_key");

-- Mark agents as initialized when table already has rows (existing deployments)
INSERT INTO "system_meta" ("key", "value", "updated_at")
SELECT 'agents_initialized', 'true', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "agents" LIMIT 1)
ON CONFLICT ("key") DO NOTHING;
