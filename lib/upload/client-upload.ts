export type UploadProgressHandler = (progress: {
  loaded: number;
  total: number;
  percent: number;
}) => void;

export type AuditUploadMode = "image" | "audio";

export type AuditUploadResult = {
  path: string;
  filename?: string;
  size?: number;
};

const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

export function uploadAuditAttachment(
  file: File,
  mode: AuditUploadMode,
  options?: {
    onProgress?: UploadProgressHandler;
    signal?: AbortSignal;
  }
): Promise<AuditUploadResult> {
  const endpoint =
    mode === "image"
      ? "/api/uploads/audit-images"
      : "/api/uploads/audit-media";

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    const timeoutId = window.setTimeout(() => {
      xhr.abort();
      reject(
        new Error(
          "Upload timed out. Check your connection and try again with a smaller file if needed."
        )
      );
    }, UPLOAD_TIMEOUT_MS);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
    };

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable || !options?.onProgress) return;
      options.onProgress({
        loaded: event.loaded,
        total: event.total,
        percent: Math.min(
          100,
          Math.round((event.loaded / event.total) * 100)
        ),
      });
    });

    xhr.addEventListener("load", () => {
      cleanup();
      let payload: { path?: string; filename?: string; size?: number; error?: string };
      try {
        payload = JSON.parse(xhr.responseText) as typeof payload;
      } catch {
        reject(new Error("Upload failed — invalid server response."));
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300 && payload.path) {
        resolve({
          path: payload.path,
          filename: payload.filename,
          size: payload.size,
        });
        return;
      }

      reject(new Error(payload.error ?? `Upload failed (${xhr.status}).`));
    });

    xhr.addEventListener("error", () => {
      cleanup();
      reject(new Error("Network error during upload. Check your connection."));
    });

    xhr.addEventListener("abort", () => {
      cleanup();
      reject(new Error("Upload cancelled."));
    });

    if (options?.signal) {
      if (options.signal.aborted) {
        cleanup();
        reject(new Error("Upload cancelled."));
        return;
      }
      options.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.open("POST", endpoint);
    xhr.send(formData);
  });
}
