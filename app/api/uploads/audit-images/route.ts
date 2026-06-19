import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { requireAuth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { hasScope } from "@/lib/rbac";
import {
  AUDIT_IMAGE_UPLOAD_DIR,
  auditImagePublicPath,
  buildAuditImageFilename,
  resolveAuditImageUploadPath,
  validateAuditImageFile,
} from "@/lib/upload/audit-images";
import { validateImageMagicBytes } from "@/lib/upload/validate-magic-bytes";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!hasScope(session.user.role, PERMISSIONS.AUDIT_FORM_WRITE)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid upload payload." }, { status: 400 });
  }

  const entry = formData.get("file");
  if (!(entry instanceof File)) {
    return Response.json({ error: "No image file provided." }, { status: 400 });
  }

  const validation = validateAuditImageFile(entry);
  if (!validation.ok) {
    return Response.json({ error: validation.error }, { status: 400 });
  }

  const filename = buildAuditImageFilename(entry.name, validation.extension);
  const absoluteDir = path.join(process.cwd(), AUDIT_IMAGE_UPLOAD_DIR);
  const absolutePath = resolveAuditImageUploadPath(filename);

  try {
    await mkdir(absoluteDir, { recursive: true });
    const buffer = Buffer.from(await entry.arrayBuffer());
    const magic = validateImageMagicBytes(buffer);
    if (!magic.ok) {
      return Response.json({ error: magic.error }, { status: 400 });
    }
    await writeFile(absolutePath, buffer);
  } catch (error) {
    console.error("[upload] audit image save failed:", error);
    return Response.json(
      { error: "Could not save the image. Please try again." },
      { status: 500 }
    );
  }

  return Response.json({
    path: auditImagePublicPath(filename),
    filename,
    size: entry.size,
  });
}
