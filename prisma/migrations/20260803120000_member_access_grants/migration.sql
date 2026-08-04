-- CreateTable
CREATE TABLE "member_access_grants" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "granted_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_access_grants_member_id_idx" ON "member_access_grants"("member_id");

-- CreateIndex
CREATE INDEX "member_access_grants_target_user_id_idx" ON "member_access_grants"("target_user_id");

-- CreateIndex
CREATE INDEX "member_access_grants_granted_by_id_idx" ON "member_access_grants"("granted_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_access_grants_member_id_target_user_id_key" ON "member_access_grants"("member_id", "target_user_id");

-- AddForeignKey
ALTER TABLE "member_access_grants" ADD CONSTRAINT "member_access_grants_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_access_grants" ADD CONSTRAINT "member_access_grants_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_access_grants" ADD CONSTRAINT "member_access_grants_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
