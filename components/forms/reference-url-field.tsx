"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
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
    hint: "Screenshot or chat capture",
    icon: ImageIcon,
  },
  {
    id: "audio",
    label: "Audio",
    hint: "Call or voice recording",
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuLayout, setMenuLayout] = useState<MenuLayout | null>(null);
  const [modalKind, setModalKind] = useState<ReferenceAttachmentKind | null>(
    null
  );
  const [draftUrl, setDraftUrl] = useState("");
  const [draftAuditCode, setDraftAuditCode] = useState("");
  const [uploading, setUploading] = useState(false);
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

  const label = isChat ? "Interaction reference" : "Call reference";
  const optionalHint = required
    ? null
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
  }

  function closeModal() {
    if (uploading) return;
    setModalKind(null);
  }

  function applyValue(next: string, labelHint?: string) {
    onChange(next);
    if (labelHint) setUploadLabel(labelHint);
    setModalKind(null);
  }

  function clearValue() {
    onChange("");
    setUploadLabel(null);
  }

  async function handleFileSelect(
    file: File | undefined,
    uploadMode: "image" | "audio"
  ) {
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

      applyValue(payload.path, file.name);
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
        ? "Upload a screenshot or chat capture (JPG, PNG, WebP, GIF — up to 10 MB)."
        : modalKind === "audio"
          ? "Upload a call or voice recording (MP3, WAV, M4A, AAC, WebM, OGG, FLAC — up to 25 MB)."
          : modalKind === "audit"
            ? "Pick a recent audit from your scope or enter an audit code."
            : undefined;

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
        {hasValue ? (
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
                preload="none"
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
        ) : (
          <div className="audit-ref-attach__empty">
            <FileText size={16} aria-hidden />
            <span>No reference attached</span>
          </div>
        )}

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

      {optionalHint ? (
        <p className="audit-field__hint ui-hint">{optionalHint}</p>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        className="audit-reference-field__file-input"
        accept={
          modalKind === "image"
            ? "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
            : "audio/*,.mp3,.wav,.m4a,.aac,.webm,.ogg,.flac"
        }
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (modalKind === "image") void handleFileSelect(file, "image");
          if (modalKind === "audio") void handleFileSelect(file, "audio");
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
            <button
              type="button"
              className="audit-ref-modal__dropzone"
              disabled={disabled || uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 size={22} className="audit-reference-field__spin" aria-hidden />
              ) : (
                <Upload size={22} aria-hidden />
              )}
              <strong>
                {uploading
                  ? "Uploading…"
                  : modalKind === "image"
                    ? "Choose image file"
                    : "Choose audio file"}
              </strong>
              <span>
                {modalKind === "image"
                  ? "JPG, PNG, WebP, or GIF"
                  : "MP3, WAV, M4A, AAC, WebM, OGG, or FLAC"}
              </span>
            </button>
            <div className="audit-ref-modal__actions">
              <button
                type="button"
                className="ui-btn ui-btn--secondary ui-btn--sm"
                disabled={uploading}
                onClick={closeModal}
              >
                Cancel
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
