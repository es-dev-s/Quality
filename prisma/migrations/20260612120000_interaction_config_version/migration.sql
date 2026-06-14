-- Reliable optimistic concurrency for interaction config saves
ALTER TABLE "interaction_configs" ADD COLUMN "config_version" INTEGER NOT NULL DEFAULT 0;
