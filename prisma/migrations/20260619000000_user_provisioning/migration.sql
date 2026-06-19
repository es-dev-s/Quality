-- CreateEnum
CREATE TYPE "UserProvisioningStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "created_by_id" TEXT;

-- CreateTable
CREATE TABLE "user_provisioning_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "date_of_joining" TEXT,
    "target_role_slug" TEXT NOT NULL,
    "status" "UserProvisioningStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by_id" TEXT NOT NULL,
    "reviewed_by_id" TEXT,
    "review_note" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_provisioning_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_provisioning_requests_created_user_id_key" ON "user_provisioning_requests"("created_user_id");

-- CreateIndex
CREATE INDEX "user_provisioning_requests_status_target_role_slug_idx" ON "user_provisioning_requests"("status", "target_role_slug");

-- CreateIndex
CREATE INDEX "user_provisioning_requests_requested_by_id_idx" ON "user_provisioning_requests"("requested_by_id");

-- CreateIndex
CREATE INDEX "user_provisioning_requests_email_idx" ON "user_provisioning_requests"("email");

-- CreateIndex
CREATE INDEX "User_created_by_id_idx" ON "User"("created_by_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_provisioning_requests" ADD CONSTRAINT "user_provisioning_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_provisioning_requests" ADD CONSTRAINT "user_provisioning_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_provisioning_requests" ADD CONSTRAINT "user_provisioning_requests_created_user_id_fkey" FOREIGN KEY ("created_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
