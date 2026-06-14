-- CreateTable
CREATE TABLE "interaction_configs" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "config" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interaction_configs_pkey" PRIMARY KEY ("id")
);
