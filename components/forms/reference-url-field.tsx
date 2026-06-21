"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ClipboardList,
  FileText,
  ImageIcon,
  Link2,
  Loader2,
  Mic,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { Field, Input, Label } from "@/components/primitives/field";
import { Modal } from "@/components/primitives/modal";
import { ReferenceImageViewer } from "@/components/forms/reference-image-viewer";
import { useToast } from "@/components/primitives/toast";
import type { AuditReferenceOption } from "@/lib/actions/audit";
import {
  validateClientImageFile,
  validateClientMediaFile,
} from "@/lib/upload/client-validation";
import { uploadAuditAttachment } from "@/lib/upload/client-upload";
import { formatFileSize } from "@/lib/upload/format-file-size";
import {
  AUDIT_IMAGE_MAX_MB,
  AUDIT_MEDIA_MAX_MB,
} from "@/lib/upload/limits";
import { interactionReferenceFieldLabel } from "@/lib/audit/interaction-labels";
import {
  auditCodeFromReferencePath,
  buildAuditReferenceValue,
  detectReferenceAttachmentKind,
  fileLabelFromUploadPath,
  isUploadedAudioPath,
  isUploadedImagePath,
  isUploadedReferencePath,
  referenceAttachmentLabel,
  type ReferenceAttachmentKind,
} from "@/lib/upload/reference-url-paths";
import { cn } from "@/lib/utils";

type ReferenceUrlFieldProps = {
  id?: string;
  value: string;
  interactionType: "Call" | "Chat";
  required?: boolean;
  disabled?: boolean;
  inline?: boolean;
  auditReferenceOptions?: AuditReferenceOption[];
  onChange: (value: string) => void;
};

const ATTACHMENT_OPTIONS: {
  id: ReferenceAttachmentKind;
  label: string;
  hint: string;
  icon: typeof Link2;
}[] = [
  {
    id: "url",
    label: "URL",
    hint: "CRM link, ticket ID, or external reference",
    icon: Link2,
  },
  {
    id: "image",
    label: "Image",
    hint: `Screenshot or capture (up to ${AUDIT_IMAGE_MAX_MB} MB)`,
    icon: ImageIcon,
  },
  {
    id: "audio",
    label: "Audio",
    hint: `Recording or voice note (up to ${AUDIT_MEDIA_MAX_MB} MB)`,
    icon: Mic,
  },
  {
    id: "audit",
    label: "Audit",
    hint: "Link to an existing audit record",
    icon: ClipboardList,
  },
];

function kindIcon(kind: ReferenceAttachmentKind) {
  return ATTACHMENT_OPTIONS.find((option) => option.id === kind)?.icon ?? Link2;
}

type MenuLayout = {
  top: number;
  left: number;
  width: number;
  openUp: boolean;
};

type UploadState = {
  mode: "image" | "audio";
  fileName: string;
  fileSize: number;
  percent: number;
};

function measureAttachMenu(trigger: HTMLElement): MenuLayout {
  const rect = trigger.getBoundingClientRect();
  const gap = 6;
  const padding = 8;
  const width = Math.max(rect.width, 280);
  const left = Math.min(
    Math.max(padding, rect.left),
    window.innerWidth - width - padding
  );
  const spaceBelow = window.innerHeight - rect.bottom - padding;
  const openUp = spaceBelow < 180 && rect.top > spaceBelow;
  const top = openUp ? rect.top - gap : rect.bottom + gap;
  return { top, left, width, openUp };
}

export function ReferenceUrlField({
  id = "referenceUrl",
  value,
  interactionType,
  required = false,
  disabled = false,
  inline = false,
  auditReferenceOptions = [],
  onChange,
}: ReferenceUrlFieldProps) {
  const isChat = interactionType === "Chat";
  const { toast } = useToast();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuLayout, setMenuLayout] = useState<MenuLayout | null>(null);
  const [modalKind, setModalKind] = useState<ReferenceAttachmentKind | null>(
    null
  );
  const [draftUrl, setDraftUrl] = useState("");
  const [draftAuditCode, setDraftAuditCode] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(() =>
    isUploadedReferencePath(value) && !value.startsWith("audit-ref:")
      ? fileLabelFromUploadPath(value)
      : null
  );

  const activeKind = detectReferenceAttachmentKind(value);
  const hasValue = Boolean(value.trim());
  const ActiveIcon = kindIcon(activeKind);

  const filteredAuditOptions = useMemo(() => {
    const query = draftAuditCode.trim().toLowerCase();
    if (!query) return auditReferenceOptions.slice(0, 8);
    return auditReferenceOptions
      .filter(
        (row) =>
          row.auditCode.toLowerCase().includes(query) ||
          row.agent.toLowerCase().includes(query)
      )
      .slice(0, 8);
  }, [auditReferenceOptions, draftAuditCode]);

  const label = interactionReferenceFieldLabel(interactionType);
  const fieldHint = required
    ? isChat
      ? "Required — URL, screenshot, recording, or linked audit"
      : "Required — URL, recording, image, or linked audit"
    : isChat
      ? "Optional — URL, screenshot, recording, or linked audit"
      : "Optional — URL, recording, image, or linked audit";

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuLayout(null);
      return;
    }

    function updateLayout() {
      const trigger = menuTriggerRef.current;
      if (!trigger) return;
      setMenuLayout(measureAttachMenu(trigger));
    }

    updateLayout();
    window.addEventListener("resize", updateLayout);
    window.addEventListener("scroll", updateLayout, true);
    return () => {
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("scroll", updateLayout, true);
    };
  }, [menuOpen]);

  function openModal(kind: ReferenceAttachmentKind) {
    setMenuOpen(false);
    setModalKind(kind);
    if (kind === "url") {
      setDraftUrl(isUploadedReferencePath(value) ? "" : value);
    }
    if (kind === "audit") {
      setDraftAuditCode(auditCodeFromReferencePath(value) ?? "");
    }
    if (kind === "image" || kind === "audio") {
      requestAnimationFrame(() => {
        (kind === "image" ? imageInputRef : audioInputRef).current?.click();
      });
    }
  }

  function closeModal() {
    if (uploading) return;
    setModalKind(null);
    setDragActive(false);
  }

  function cancelUpload() {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    setUploading(false);
    setUploadState(null);
  }

  function applyValue(next: string, labelHint?: string) {
    onChange(next);
    if (labelHint) setUploadLabel(labelHint);
    setModalKind(null);
    setUploadState(null);
    setDragActive(false);
  }

  function clearValue() {
    onChange("");
    setUploadLabel(null);
  }

  const handleFileSelect = useCallback(
    async (file: File | undefined, uploadMode: "image" | "audio") => {
      if (!file) return;

      const validation =
        uploadMode === "image"
          ? validateClientImageFile(file)
          : validateClientMediaFile(file);

      if (!validation.ok) {
        toast(validation.error, "error");
        return;
      }

      setModalKind(uploadMode);
      setUploading(true);
      setUploadState({
        mode: uploadMode,
        fileName: file.name,
        fileSize: file.size,
        percent: 0,
      });

      uploadAbortRef.current?.abort();
      const controller = new AbortController();
      uploadAbortRef.current = controller;

      try {
        const result = await uploadAuditAttachment(file, uploadMode, {
          signal: controller.signal,
          onProgress: ({ percent }) => {
            setUploadState((prev) =>
              prev ? { ...prev, percent } : prev
            );
          },
        });

        applyValue(result.path, file.name);
        toast(
          uploadMode === "image"
            ? `Image attached (${formatFileSize(file.size)})`
            : `Audio attached (${formatFileSize(file.size)})`,
          "success"
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message !== "Upload cancelled."
        ) {
          toast(error.message, "error");
        }
      } finally {
        setUploading(false);
        setUploadState(null);
        uploadAbortRef.current = null;
        if (imageInputRef.current) imageInputRef.current.value = "";
        if (audioInputRef.current) audioInputRef.current.value = "";
      }
    },
    [toast, onChange]
  );

  function onDropFile(file: File | undefined, mode: "image" | "audio") {
    setDragActive(false);
    void handleFileSelect(file, mode);
  }

  function saveUrl() {
    const trimmed = draftUrl.trim();
    if (!trimmed) {
      toast("Enter a URL or reference text.", "error");
      return;
    }
    applyValue(trimmed);
  }

  function saveAudit(code: string) {
    const trimmed = code.trim();
    if (!trimmed) {
      toast("Select or enter an audit code.", "error");
      return;
    }
    applyValue(buildAuditReferenceValue(trimmed));
  }

  const modalTitle =
    modalKind === "url"
      ? "Add URL reference"
      : modalKind === "image"
        ? "Add image"
        : modalKind === "audio"
          ? "Add audio recording"
          : modalKind === "audit"
            ? "Link audit record"
            : "";

  const modalDescription =
    modalKind === "url"
      ? "Paste a CRM link, ticket URL, or chat reference."
      : modalKind === "image"
        ? `Upload a screenshot or chat capture (JPG, PNG, WebP, GIF — up to ${AUDIT_IMAGE_MAX_MB} MB).`
        : modalKind === "audio"
          ? `Upload a call or voice recording (MP3, WAV, M4A, AAC, WebM, OGG, FLAC — up to ${AUDIT_MEDIA_MAX_MB} MB).`
          : modalKind === "audit"
            ? "Pick a recent audit from your scope or enter an audit code."
            : undefined;

  const uploadProgressBlock = uploadState ? (
    <div className="audit-ref-upload-progress" role="status" aria-live="polite">
      <div className="audit-ref-upload-progress__head">
        <Loader2 size={16} className="audit-reference-field__spin" aria-hidden />
        <div className="audit-ref-upload-progress__copy">
          <strong>Uploading {uploadState.fileName}</strong>
          <span>
            {formatFileSize(uploadState.fileSize)} · {uploadState.percent}%
          </span>
        </div>
        <button
          type="button"
          className="audit-ref-upload-progress__cancel"
          onClick={cancelUpload}
        >
          Cancel
        </button>
      </div>
      <div className="audit-ref-upload-progress__track">
        <div
          className="audit-ref-upload-progress__fill"
          style={{ width: `${uploadState.percent}%` }}
        />
      </div>
    </div>
  ) : null;

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
        <Label htmlFor={id}>
          {label}
          {required ? <span className="audit-required"> *</span> : null}
        </Label>
      </div>

      <div className="audit-ref-attach">
        {uploadProgressBlock}

        {hasValue && !uploadState ? (
          <div className="audit-ref-attach__chip">
            <span className="audit-ref-attach__chip-icon" aria-hidden>
              <ActiveIcon size={15} />
            </span>
            <div className="audit-ref-attach__chip-body">
              <span className="audit-ref-attach__chip-kind">
                {activeKind === "url"
                  ? "URL"
                  : activeKind === "image"
                    ? "Image"
                    : activeKind === "audio"
                      ? "Audio"
                      : "Audit"}
              </span>
              <span className="audit-ref-attach__chip-label" title={value}>
                {referenceAttachmentLabel(value)}
              </span>
            </div>
            {activeKind === "image" && isUploadedImagePath(value) ? (
              <ReferenceImageViewer
                src={value}
                filename={uploadLabel ?? fileLabelFromUploadPath(value)}
              />
            ) : activeKind === "audio" && isUploadedAudioPath(value) ? (
              <audio
                controls
                preload="metadata"
                src={value}
                className="audit-ref-attach__player"
              />
            ) : null}
            <div className="audit-ref-attach__chip-actions">
              <button
                type="button"
                className="audit-ref-attach__text-btn"
                disabled={disabled || uploading}
                onClick={() => openModal(activeKind)}
              >
                Change
              </button>
              <button
                type="button"
                className="audit-ref-attach__icon-btn"
                disabled={disabled || uploading}
                aria-label="Remove reference"
                onClick={clearValue}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : !uploadState ? (
          <div className="audit-ref-attach__empty">
            <FileText size={16} aria-hidden />
            <span>No reference attached</span>
          </div>
        ) : null}

        <div className="audit-ref-attach__menu-wrap">
          <button
            ref={menuTriggerRef}
            type="button"
            className="audit-ref-attach__add-btn"
            disabled={disabled || uploading}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Plus size={15} aria-hidden />
            Add reference
            <ChevronDown
              size={14}
              className={cn(
                "audit-ref-attach__chevron",
                menuOpen && "audit-ref-attach__chevron--open"
              )}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {menuOpen && menuLayout && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                className="audit-ref-attach__menu-backdrop"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              />
              <div
                className={cn(
                  "audit-ref-attach__menu audit-ref-attach__menu--portal",
                  menuLayout.openUp && "audit-ref-attach__menu--up"
                )}
                role="menu"
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  top: menuLayout.top,
                  left: menuLayout.left,
                  width: menuLayout.width,
                }}
              >
                {ATTACHMENT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="menuitem"
                      className="audit-ref-attach__menu-item"
                      disabled={uploading}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={() => openModal(option.id)}
                    >
                      <span className="audit-ref-attach__menu-icon" aria-hidden>
                        <Icon size={16} />
                      </span>
                      <span className="audit-ref-attach__menu-copy">
                        <strong>{option.label}</strong>
                        <span>{option.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>,
            document.body
          )
        : null}

      {fieldHint ? (
        <p className="audit-field__hint ui-hint">{fieldHint}</p>
      ) : null}

      <input
        ref={imageInputRef}
        type="file"
        className="audit-reference-field__file-input"
        tabIndex={-1}
        aria-hidden
        accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
        onChange={(e) => {
          void handleFileSelect(e.target.files?.[0], "image");
        }}
      />
      <input
        ref={audioInputRef}
        type="file"
        className="audit-reference-field__file-input"
        tabIndex={-1}
        aria-hidden
        accept="audio/*,.mp3,.wav,.m4a,.aac,.webm,.ogg,.flac"
        onChange={(e) => {
          void handleFileSelect(e.target.files?.[0], "audio");
        }}
      />

      <Modal
        open={modalKind !== null}
        onClose={closeModal}
        title={modalTitle}
        description={modalDescription}
        className="audit-ref-modal"
      >
        {modalKind === "url" ? (
          <div className="audit-ref-modal__body">
            <Input
              id={`${id}-modal-url`}
              className="audit-control"
              type="text"
              inputMode="url"
              autoFocus
              placeholder={
                isChat
                  ? "Chat ID, ticket URL, or CRM link"
                  : "https://crm.example.com/ticket/12345"
              }
              value={draftUrl}
              disabled={disabled || uploading}
              onChange={(e) => setDraftUrl(e.target.value)}
            />
            <div className="audit-ref-modal__actions">
              <button
                type="button"
                className="ui-btn ui-btn--secondary ui-btn--sm"
                disabled={uploading}
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--primary ui-btn--sm"
                disabled={uploading}
                onClick={saveUrl}
              >
                Save URL
              </button>
            </div>
          </div>
        ) : null}

        {modalKind === "image" || modalKind === "audio" ? (
          <div className="audit-ref-modal__body">
            {uploadProgressBlock ?? (
              <button
                type="button"
                className={cn(
                  "audit-ref-modal__dropzone",
                  dragActive && "audit-ref-modal__dropzone--active"
                )}
                disabled={disabled || uploading}
                onClick={() =>
                  (modalKind === "image" ? imageInputRef : audioInputRef).current?.click()
                }
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDropFile(e.dataTransfer.files?.[0], modalKind);
                }}
              >
                <Upload size={22} aria-hidden />
                <strong>
                  {modalKind === "image"
                    ? "Choose or drop image"
                    : "Choose or drop audio"}
                </strong>
                <span>
                  {modalKind === "image"
                    ? `JPG, PNG, WebP, or GIF · up to ${AUDIT_IMAGE_MAX_MB} MB`
                    : `MP3, WAV, M4A, AAC, WebM, OGG, or FLAC · up to ${AUDIT_MEDIA_MAX_MB} MB`}
                </span>
              </button>
            )}
            <div className="audit-ref-modal__actions">
              <button
                type="button"
                className="ui-btn ui-btn--secondary ui-btn--sm"
                disabled={uploading}
                onClick={uploading ? cancelUpload : closeModal}
              >
                {uploading ? "Cancel upload" : "Close"}
              </button>
            </div>
          </div>
        ) : null}

        {modalKind === "audit" ? (
          <div className="audit-ref-modal__body">
            <Input
              id={`${id}-modal-audit`}
              className="audit-control"
              type="text"
              autoFocus
              placeholder="Search by audit code or agent"
              value={draftAuditCode}
              disabled={disabled || uploading}
              onChange={(e) => setDraftAuditCode(e.target.value)}
            />
            {filteredAuditOptions.length > 0 ? (
              <ul className="audit-ref-modal__audit-list">
                {filteredAuditOptions.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="audit-ref-modal__audit-item"
                      onClick={() => saveAudit(row.auditCode)}
                    >
                      <strong>{row.auditCode}</strong>
                      <span>
                        {row.agent} · {row.type} · {row.auditDate}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="audit-ref-modal__empty">
                No matching audits in your scope.
              </p>
            )}
            <div className="audit-ref-modal__actions">
              <button
                type="button"
                className="ui-btn ui-btn--secondary ui-btn--sm"
                disabled={uploading}
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--primary ui-btn--sm"
                disabled={uploading || !draftAuditCode.trim()}
                onClick={() => saveAudit(draftAuditCode)}
              >
                Link audit
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </Field>
  );
}
