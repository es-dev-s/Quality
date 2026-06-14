-- CreateTable
CREATE TABLE "role_form_templates" (
    "role_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_form_templates_pkey" PRIMARY KEY ("role_id","template_id")
);

-- AddForeignKey
ALTER TABLE "role_form_templates" ADD CONSTRAINT "role_form_templates_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_form_templates" ADD CONSTRAINT "role_form_templates_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "form_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
