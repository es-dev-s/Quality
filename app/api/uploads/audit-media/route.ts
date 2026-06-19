import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { hasScope } from "@/lib/rbac";
import {
  AUDIT_MEDIA_UPLOAD_DIR,
  auditMediaPublicPath,
  buildAuditMediaFilename,
  resolveAuditMediaUploadPath,
  validateAuditMediaFile,
} from "@/lib/upload/audit-media";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
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
    return Response.json({ error: "No audio file provided." }, { status: 400 });
  }

  const validation = validateAuditMediaFile(entry);
  if (!validation.ok) {
    return Response.json({ error: validation.error }, { status: 400 });
  }

  const filename = buildAuditMediaFilename(entry.name, validation.extension);
  const absoluteDir = path.join(process.cwd(), AUDIT_MEDIA_UPLOAD_DIR);
  const absolutePath = resolveAuditMediaUploadPath(filename);

  try {
    await mkdir(absoluteDir, { recursive: true });
    const buffer = Buffer.from(await entry.arrayBuffer());
    await writeFile(absolutePath, buffer);
  } catch (error) {
    console.error("[upload] audit media save failed:", error);
    return Response.json(
      { error: "Could not save the audio file. Please try again." },
      { status: 500 }
    );
  }

  return Response.json({
    path: auditMediaPublicPath(filename),
    filename,
    size: entry.size,
  });
}
