-- CreateTable
CREATE TABLE "form_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "lob" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sections" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_template_preferences" (
    "user_id" TEXT NOT NULL,
    "active_template_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_template_preferences_pkey" PRIMARY KEY ("user_id")
);

-- AlterTable
ALTER TABLE "AuditSubmission" ADD COLUMN "template_id" TEXT;

-- AddForeignKey
ALTER TABLE "user_template_preferences" ADD CONSTRAINT "user_template_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_template_preferences" ADD CONSTRAINT "user_template_preferences_active_template_id_fkey" FOREIGN KEY ("active_template_id") REFERENCES "form_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSubmission" ADD CONSTRAINT "AuditSubmission_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "form_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
