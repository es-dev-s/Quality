import { readFile } from "fs/promises";
import { requireAuth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { hasScope } from "@/lib/rbac";
import {
  AUDIT_MEDIA_UPLOAD_DIR,
  resolveAuditMediaUploadPath,
} from "@/lib/upload/audit-media";
import {
  contentTypeForMedia,
  isSafeUploadFilename,
  resolveStorageFilePath,
} from "@/lib/upload/serve-file";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!hasScope(session.user.role, PERMISSIONS.AUDIT_FORM_READ)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { filename } = await params;
  if (!isSafeUploadFilename(filename)) {
    return new Response("Bad request", { status: 400 });
  }

  const resolved = resolveStorageFilePath(AUDIT_MEDIA_UPLOAD_DIR, filename);
  if (!resolved) {
    return new Response("Bad request", { status: 400 });
  }

  const expected = resolveAuditMediaUploadPath(filename);
  if (resolved !== expected) {
    return new Response("Bad request", { status: 400 });
  }

  try {
    const buffer = await readFile(resolved);
    return new Response(buffer, {
      headers: {
        "Content-Type": contentTypeForMedia(filename),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
