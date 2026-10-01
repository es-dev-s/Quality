"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
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
  MAX_REFERENCE_ITEM_LENGTH,
  MAX_REFERENCE_ITEMS,
  auditCodeFromReferencePath,
  buildAuditReferenceValue,
  detectReferenceAttachmentKind,
  fileLabelFromUploadPath,
  isUploadedAudioPath,
  isUploadedImagePath,
  normalizeUploadedReferencePath,
  parseReferenceList,
  referenceAttachmentLabel,
  serializeReferenceList,
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
  fieldClassName?: string;
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
    label: "Images",
    hint: `Screenshots or captures — select several at once (up to ${AUDIT_IMAGE_MAX_MB} MB each)`,
    icon: ImageIcon,
  },
  {
    id: "audio",
    label: "Audio",
    hint: `Recordings or voice notes — select several at once (up to ${AUDIT_MEDIA_MAX_MB} MB each)`,
    icon: Mic,
  },
  {
    id: "audit",
    label: "Audit",
    hint: "Link to an existing audit record",
    icon: ClipboardList,
  },
];

const KIND_LABEL: Record<ReferenceAttachmentKind, string> = {
  url: "URL",
  image: "Image",
  audio: "Audio",
  audit: "Audit",
};

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
  index: number;
  total: number;
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

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function summarizeFailures(failures: string[], verb: string): string {
  if (failures.length === 1) return failures[0]!;
  return `${failures.length} files ${verb} — ${failures[0]}`;
}

export function ReferenceUrlField({
  id = "referenceUrl",
  value,
  interactionType,
  required = false,
  disabled = false,
  inline = false,
  fieldClassName,
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [draftAuditCode, setDraftAuditCode] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const items = useMemo(() => parseReferenceList(value), [value]);
  // Uploads run sequentially and commit one by one; the ref always holds the
  // latest list so a later commit never overwrites an earlier one.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => uploadAbortRef.current?.abort();
  }, []);

  const remainingSlots = Math.max(0, MAX_REFERENCE_ITEMS - items.length);
  const atCapacity = remainingSlots === 0;

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
  const fieldHint = atCapacity
    ? `Maximum of ${MAX_REFERENCE_ITEMS} references reached — remove one to add another.`
    : required
      ? isChat
        ? "Required — add one or more: URL, screenshots, recordings, or linked audits"
        : "Required — add one or more: URL, recordings, images, or linked audits"
      : isChat
        ? "Optional — add one or more: URL, screenshots, recordings, or linked audits"
        : "Optional — add one or more: URL, recordings, images, or linked audits";

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

  function commitItems(next: string[]) {
    const serialized = serializeReferenceList(next);
    itemsRef.current = parseReferenceList(serialized);
    onChange(serialized);
  }

  function removeItem(index: number) {
    commitItems(itemsRef.current.filter((_, i) => i !== index));
  }

  /** Adds or replaces (when editing) a single reference. Returns false if rejected. */
  function upsertItem(next: string, index: number | null): boolean {
    const current = itemsRef.current;
    const duplicateAt = current.indexOf(next);
    if (duplicateAt !== -1 && duplicateAt !== index) {
      toast("That reference is already attached.", "error");
      return false;
    }
    if (index !== null && index < current.length) {
      commitItems(current.map((item, i) => (i === index ? next : item)));
      return true;
    }
    if (current.length >= MAX_REFERENCE_ITEMS) {
      toast(`You can attach up to ${MAX_REFERENCE_ITEMS} references.`, "error");
      return false;
    }
    commitItems([...current, next]);
    return true;
  }

  function openModal(kind: ReferenceAttachmentKind, index: number | null = null) {
    setMenuOpen(false);
    setModalKind(kind);
    setEditingIndex(index);
    const existing = index !== null ? items[index] ?? "" : "";
    if (kind === "url") {
      setDraftUrl(existing);
    }
    if (kind === "audit") {
      setDraftAuditCode(auditCodeFromReferencePath(existing) ?? "");
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
    setEditingIndex(null);
    setDragActive(false);
  }

  function finishModal() {
    setModalKind(null);
    setEditingIndex(null);
    setDragActive(false);
  }

  function cancelUpload() {
    uploadAbortRef.current?.abort();
  }

  async function handleFiles(files: File[], uploadMode: "image" | "audio") {
    if (files.length === 0 || uploading) return;

    const slots = MAX_REFERENCE_ITEMS - itemsRef.current.length;
    if (slots <= 0) {
      toast(`You can attach up to ${MAX_REFERENCE_ITEMS} references.`, "error");
      return;
    }

    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of files) {
      const validation =
        uploadMode === "image"
          ? validateClientImageFile(file)
          : validateClientMediaFile(file);
      if (validation.ok) {
        accepted.push(file);
      } else {
        rejected.push(`${file.name}: ${validation.error}`);
      }
    }

    if (rejected.length > 0) {
      toast(summarizeFailures(rejected, "skipped"), "error");
    }

    let queue = accepted;
    if (queue.length > slots) {
      toast(
        `Only ${slots} more ${pluralize(slots, "reference")} can be attached — uploading the first ${slots}.`,
        "warning"
      );
      queue = queue.slice(0, slots);
    }
    if (queue.length === 0) return;

    uploadAbortRef.current?.abort();
    const controller = new AbortController();
    uploadAbortRef.current = controller;

    setModalKind(uploadMode);
    setEditingIndex(null);
    setUploading(true);

    let uploadedCount = 0;
    let uploadedBytes = 0;
    const failures: string[] = [];

    for (let index = 0; index < queue.length; index += 1) {
      if (controller.signal.aborted) break;
      const file = queue[index]!;
      setUploadState({
        mode: uploadMode,
        fileName: file.name,
        fileSize: file.size,
        percent: 0,
        index,
        total: queue.length,
      });

      try {
        const result = await uploadAuditAttachment(file, uploadMode, {
          signal: controller.signal,
          onProgress: ({ percent }) => {
            setUploadState((prev) => (prev ? { ...prev, percent } : prev));
          },
        });
        commitItems([...itemsRef.current, result.path]);
        uploadedCount += 1;
        uploadedBytes += file.size;
      } catch (error) {
        if (controller.signal.aborted) break;
        failures.push(
          `${file.name}: ${error instanceof Error ? error.message : "Upload failed."}`
        );
      }
    }

    const cancelled = controller.signal.aborted;
    if (uploadAbortRef.current === controller) {
      uploadAbortRef.current = null;
    }
    setUploading(false);
    setUploadState(null);

    if (uploadedCount > 0) {
      const noun =
        uploadMode === "image"
          ? pluralize(uploadedCount, "Image", "images")
          : pluralize(uploadedCount, "Audio file", "audio files");
      toast(
        uploadedCount === 1
          ? `${noun} attached (${formatFileSize(uploadedBytes)})`
          : `${uploadedCount} ${noun} attached (${formatFileSize(uploadedBytes)})`,
        "success"
      );
    }
    if (failures.length > 0) {
      toast(summarizeFailures(failures, "failed to upload"), "error");
    }
    if (cancelled && uploadedCount < queue.length) {
      toast(
        `Upload cancelled — ${uploadedCount} of ${queue.length} ${pluralize(queue.length, "file")} attached.`,
        "info"
      );
    }

    if (!cancelled && failures.length === 0) {
      finishModal();
    }
  }

  function onFileInputChange(
    event: ChangeEvent<HTMLInputElement>,
    mode: "image" | "audio"
  ) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void handleFiles(files, mode);
  }

  function onDropFiles(fileList: FileList | undefined, mode: "image" | "audio") {
    setDragActive(false);
    void handleFiles(Array.from(fileList ?? []), mode);
  }

  function saveUrl() {
    const trimmed = draftUrl.replace(/\s*[\r\n]+\s*/g, " ").trim();
    if (!trimmed) {
      toast("Enter a URL or reference text.", "error");
      return;
    }
    if (trimmed.length > MAX_REFERENCE_ITEM_LENGTH) {
      toast(
        `References must be ${MAX_REFERENCE_ITEM_LENGTH} characters or fewer.`,
        "error"
      );
      return;
    }
    if (upsertItem(trimmed, editingIndex)) finishModal();
  }

  function saveAudit(code: string) {
    const trimmed = code.trim();
    if (!trimmed) {
      toast("Select or enter an audit code.", "error");
      return;
    }
    if (upsertItem(buildAuditReferenceValue(trimmed), editingIndex)) finishModal();
  }

  const isEditing = editingIndex !== null;

  const modalTitle =
    modalKind === "url"
      ? isEditing
        ? "Edit URL reference"
        : "Add URL reference"
      : modalKind === "image"
        ? "Add images"
        : modalKind === "audio"
          ? "Add audio recordings"
          : modalKind === "audit"
            ? isEditing
              ? "Change linked audit"
              : "Link audit record"
            : "";

  const modalDescription =
    modalKind === "url"
      ? "Paste a CRM link, ticket URL, or chat reference."
      : modalKind === "image"
        ? `Upload one or more screenshots or chat captures (JPG, PNG, WebP, GIF — up to ${AUDIT_IMAGE_MAX_MB} MB each).`
        : modalKind === "audio"
          ? `Upload one or more call or voice recordings (MP3, WAV, M4A, AAC, WebM, OGG, FLAC — up to ${AUDIT_MEDIA_MAX_MB} MB each).`
          : modalKind === "audit"
            ? "Pick a recent audit from your scope or enter an audit code."
            : undefined;

  const overallPercent = uploadState
    ? Math.round(
        ((uploadState.index + uploadState.percent / 100) / uploadState.total) * 100
      )
    : 0;

  const uploadProgressBlock = uploadState ? (
    <div className="audit-ref-upload-progress" role="status" aria-live="polite">
      <div className="audit-ref-upload-progress__head">
        <Loader2 size={16} className="audit-reference-field__spin" aria-hidden />
        <div className="audit-ref-upload-progress__copy">
          <strong title={uploadState.fileName}>
            {uploadState.total > 1
              ? `Uploading ${uploadState.index + 1} of ${uploadState.total}: ${uploadState.fileName}`
              : `Uploading ${uploadState.fileName}`}
          </strong>
          <span>
            {formatFileSize(uploadState.fileSize)} · {uploadState.percent}%
            {uploadState.total > 1 ? ` · ${overallPercent}% overall` : ""}
          </span>
        </div>
        <button
          type="button"
          className="audit-ref-upload-progress__cancel"
          onClick={cancelUpload}
        >
          {uploadState.total > 1 ? "Cancel all" : "Cancel"}
        </button>
      </div>
      <div className="audit-ref-upload-progress__track">
        <div
          className="audit-ref-upload-progress__fill"
          style={{ width: `${uploadState.total > 1 ? overallPercent : uploadState.percent}%` }}
        />
      </div>
    </div>
  ) : null;

  return (
    <Field
      className={cn(
        "audit-field audit-reference-field",
        inline && "audit-contact-field",
        fieldClassName
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
        {items.length > 0 ? (
          <span className="audit-ref-attach__count" aria-label={`${items.length} of ${MAX_REFERENCE_ITEMS} references attached`}>
            {items.length} / {MAX_REFERENCE_ITEMS}
          </span>
        ) : null}
      </div>

      <div className="audit-ref-attach">
        {items.length > 0 ? (
          <ul className="audit-ref-attach__list" aria-label={`${label} attachments`}>
            {items.map((item, index) => {
              const kind = detectReferenceAttachmentKind(item);
              const Icon = kindIcon(kind);
              const src = normalizeUploadedReferencePath(item);
              const itemLabel = referenceAttachmentLabel(item);
              const editable = kind === "url" || kind === "audit";
              return (
                <li key={item} className="audit-ref-attach__chip">
                  <span className="audit-ref-attach__chip-icon" aria-hidden>
                    <Icon size={15} />
                  </span>
                  <div className="audit-ref-attach__chip-body">
                    <span className="audit-ref-attach__chip-kind">{KIND_LABEL[kind]}</span>
                    <span className="audit-ref-attach__chip-label" title={item}>
                      {itemLabel}
                    </span>
                  </div>
                  {kind === "image" && isUploadedImagePath(item) ? (
                    <ReferenceImageViewer
                      src={src}
                      filename={fileLabelFromUploadPath(item)}
                    />
                  ) : kind === "audio" && isUploadedAudioPath(item) ? (
                    <audio
                      controls
                      preload="metadata"
                      src={src}
                      className="audit-ref-attach__player"
                    />
                  ) : null}
                  <div className="audit-ref-attach__chip-actions">
                    {editable ? (
                      <button
                        type="button"
                        className="audit-ref-attach__text-btn"
                        disabled={disabled || uploading}
                        onClick={() => openModal(kind, index)}
                      >
                        Edit
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="audit-ref-attach__icon-btn"
                      disabled={disabled || uploading}
                      aria-label={`Remove ${itemLabel}`}
                      onClick={() => removeItem(index)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : !uploadState ? (
          <div className="audit-ref-attach__empty">
            <FileText size={16} aria-hidden />
            <span>No reference attached</span>
          </div>
        ) : null}

        {uploadProgressBlock}

        <div className="audit-ref-attach__menu-wrap">
          <button
            ref={menuTriggerRef}
            type="button"
            className="audit-ref-attach__add-btn"
            disabled={disabled || uploading || atCapacity}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Plus size={15} aria-hidden />
            {items.length > 0 ? "Add more" : "Add reference"}
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
                      disabled={uploading || atCapacity}
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
        multiple
        className="audit-reference-field__file-input"
        tabIndex={-1}
        aria-hidden
        accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
        onChange={(e) => onFileInputChange(e, "image")}
      />
      <input
        ref={audioInputRef}
        type="file"
        multiple
        className="audit-reference-field__file-input"
        tabIndex={-1}
        aria-hidden
        accept="audio/*,.mp3,.wav,.m4a,.aac,.webm,.ogg,.flac"
        onChange={(e) => onFileInputChange(e, "audio")}
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
              maxLength={MAX_REFERENCE_ITEM_LENGTH}
              disabled={disabled || uploading}
              onChange={(e) => setDraftUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveUrl();
                }
              }}
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
                {isEditing ? "Save changes" : "Save URL"}
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
                disabled={disabled || uploading || atCapacity}
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
                  onDropFiles(e.dataTransfer.files, modalKind);
                }}
              >
                <Upload size={22} aria-hidden />
                <strong>
                  {modalKind === "image"
                    ? "Choose or drop images"
                    : "Choose or drop audio files"}
                </strong>
                <span>
                  {modalKind === "image"
                    ? `JPG, PNG, WebP, or GIF · up to ${AUDIT_IMAGE_MAX_MB} MB each`
                    : `MP3, WAV, M4A, AAC, WebM, OGG, or FLAC · up to ${AUDIT_MEDIA_MAX_MB} MB each`}
                </span>
                <span>
                  {atCapacity
                    ? `Maximum of ${MAX_REFERENCE_ITEMS} references reached`
                    : `Select multiple files at once · ${remainingSlots} of ${MAX_REFERENCE_ITEMS} slots left`}
                </span>
              </button>
            )}
            <div className="audit-ref-modal__actions">
              <button
                type="button"
                className="ui-btn ui-btn--secondary ui-btn--sm"
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
                {isEditing ? "Save changes" : "Link audit"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </Field>
  );
}
