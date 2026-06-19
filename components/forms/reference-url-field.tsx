"use client";

import { useRef, useState } from "react";
import { ImageIcon, Link2, Loader2, Mic, Upload } from "lucide-react";
import { Field, Input, Label } from "@/components/primitives/field";
import { ReferenceImageViewer } from "@/components/forms/reference-image-viewer";
import { useToast } from "@/components/primitives/toast";
import {
  fileLabelFromUploadPath,
  isUploadedAudioPath,
  isUploadedImagePath,
  isUploadedReferencePath,
} from "@/lib/upload/reference-url-paths";
import { cn } from "@/lib/utils";

type UploadMode = "url" | "audio" | "image";

type ReferenceUrlFieldProps = {
  id?: string;
  value: string;
  interactionType: "Call" | "Chat";
  required?: boolean;
  disabled?: boolean;
  /** When true, label row matches Mobile Number field in a side-by-side row. */
  inline?: boolean;
  onChange: (value: string) => void;
};

function initialMode(
  value: string,
  interactionType: "Call" | "Chat"
): UploadMode {
  if (isUploadedImagePath(value)) return "image";
  if (interactionType === "Call" && isUploadedAudioPath(value)) return "audio";
  return "url";
}

export function ReferenceUrlField({
  id = "referenceUrl",
  value,
  interactionType,
  required = false,
  disabled = false,
  inline = false,
  onChange,
}: ReferenceUrlFieldProps) {
  const isChat = interactionType === "Chat";
  const uploadMode: "audio" | "image" = isChat ? "image" : "audio";

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<UploadMode>(() =>
    initialMode(value, interactionType)
  );
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(() =>
    isUploadedReferencePath(value) ? fileLabelFromUploadPath(value) : null
  );

  const label = isChat
    ? "Chat Reference URL / Image"
    : "Reference URL / Recording";

  async function handleFileSelect(file: File | undefined) {
    if (!file) return;

    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);

      const endpoint =
        uploadMode === "image"
          ? "/api/uploads/audit-images"
          : "/api/uploads/audit-media";

      const response = await fetch(endpoint, {
        method: "POST",
        body,
      });

      const payload = (await response.json()) as {
        path?: string;
        error?: string;
      };

      if (!response.ok || !payload.path) {
        throw new Error(payload.error ?? "Upload failed.");
      }

      onChange(payload.path);
      setUploadLabel(file.name);
      toast(
        uploadMode === "image"
          ? `Image saved: ${file.name}`
          : `Audio saved: ${file.name}`,
        "success"
      );
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : uploadMode === "image"
            ? "Could not upload image."
            : "Could not upload audio.",
        "error"
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function switchMode(next: UploadMode) {
    setMode(next);
    if (next === "url" && isUploadedReferencePath(value)) {
      onChange("");
      setUploadLabel(null);
    }
  }

  const showUploadPanel = mode === uploadMode;
  const hasUploadedFile =
    uploadMode === "image"
      ? isUploadedImagePath(value)
      : isUploadedAudioPath(value);

  return (
    <Field
      className={cn(
        "audit-field audit-reference-field",
        inline && "audit-contact-field"
      )}
    >
      <div
        className={cn(
          "audit-reference-field__head",
          inline && "audit-contact-field__label-row"
        )}
      >
        <Label htmlFor={mode === "url" ? id : `${id}-file`}>
          {label}
          {required ? <span className="audit-required"> *</span> : null}
        </Label>
        <div
          className="audit-reference-field__modes"
          role="tablist"
          aria-label="Reference type"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "url"}
            className={cn(
              "audit-reference-field__mode",
              mode === "url" && "audit-reference-field__mode--active"
            )}
            disabled={disabled || uploading}
            onClick={() => switchMode("url")}
          >
            <Link2 size={14} aria-hidden />
            URL
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={showUploadPanel}
            className={cn(
              "audit-reference-field__mode",
              showUploadPanel && "audit-reference-field__mode--active"
            )}
            disabled={disabled || uploading}
            onClick={() => switchMode(uploadMode)}
          >
            {isChat ? (
              <ImageIcon size={14} aria-hidden />
            ) : (
              <Mic size={14} aria-hidden />
            )}
            {isChat ? "Image" : "Audio"}
          </button>
        </div>
      </div>

      {mode === "url" ? (
        <Input
          id={id}
          className="audit-control audit-reference-field__control"
          type="text"
          inputMode="url"
          placeholder={
            isChat
              ? "Chat ID, ticket URL, or CRM link"
              : "https://crm.example.com/ticket/12345"
          }
          value={isUploadedReferencePath(value) ? "" : value}
          required={required && mode === "url"}
          disabled={disabled || uploading}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="audit-reference-field__upload audit-reference-field__control">
          <input
            ref={fileInputRef}
            id={`${id}-file`}
            type="file"
            accept={
              isChat
                ? "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                : "audio/*,.mp3,.wav,.m4a,.aac,.webm,.ogg,.flac"
            }
            className="audit-reference-field__file-input"
            disabled={disabled || uploading}
            onChange={(e) => void handleFileSelect(e.target.files?.[0])}
          />
          <button
            type="button"
            className="audit-reference-field__upload-btn"
            disabled={disabled || uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 size={16} className="audit-reference-field__spin" aria-hidden />
            ) : (
              <Upload size={16} aria-hidden />
            )}
            {uploading
              ? "Uploading…"
              : isChat
                ? "Choose image file"
                : "Choose audio file"}
          </button>
          {hasUploadedFile ? (
            <div className="audit-reference-field__upload-meta">
              {isChat && isUploadedImagePath(value) ? (
                <ReferenceImageViewer
                  src={value}
                  filename={uploadLabel ?? fileLabelFromUploadPath(value)}
                />
              ) : (
                <audio
                  controls
                  preload="none"
                  src={value}
                  className="audit-reference-field__player"
                />
              )}
              {!isChat || !isUploadedImagePath(value) ? (
                <p className="audit-reference-field__filename">
                  {uploadLabel ?? fileLabelFromUploadPath(value)}
                </p>
              ) : null}
              <button
                type="button"
                className="audit-reference-field__clear"
                disabled={disabled || uploading}
                onClick={() => {
                  onChange("");
                  setUploadLabel(null);
                }}
              >
                Remove
              </button>
            </div>
          ) : (
            <p className="audit-reference-field__hint">
              {isChat ? (
                <>
                  JPG, PNG, WebP, or GIF — up to 10 MB. Saved under{" "}
                  <code>public/uploads/audit-images/</code>.
                </>
              ) : (
                <>
                  MP3, WAV, M4A, AAC, WebM, OGG, or FLAC — up to 25 MB. Saved
                  under <code>public/uploads/audit-media/</code>.
                </>
              )}
            </p>
          )}
        </div>
      )}
    </Field>
  );
}
