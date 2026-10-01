"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  ImageIcon,
  Link2,
  Mic,
} from "lucide-react";
import { Modal } from "@/components/primitives/modal";
import { ReferenceImageViewer } from "@/components/forms/reference-image-viewer";
import { interactionReferenceListLabel } from "@/lib/audit/interaction-labels";
import {
  auditCodeFromReferencePath,
  detectReferenceAttachmentKind,
  fileLabelFromUploadPath,
  isAuditReferencePath,
  isUploadedAudioPath,
  isUploadedImagePath,
  normalizeUploadedReferencePath,
  parseReferenceList,
  referenceAttachmentLabel,
  type ReferenceAttachmentKind,
} from "@/lib/upload/reference-url-paths";
import { cn } from "@/lib/utils";

type ReferenceAttachmentViewProps = {
  referenceUrl: string | null | undefined;
  interactionType?: string;
  variant?: "compact" | "full";
  className?: string;
};

/** Parsed, display-ready reference items (legacy upload paths rewritten to API paths). */
export function parseReferenceItems(
  referenceUrl: string | null | undefined
): { href: string; kind: ReferenceAttachmentKind }[] {
  return parseReferenceList(referenceUrl).map((raw) => {
    const href = normalizeUploadedReferencePath(raw);
    return { href, kind: detectReferenceAttachmentKind(href) };
  });
}

type ReferenceItem = ReturnType<typeof parseReferenceItems>[number];

const STRIP_VISIBLE_COUNT = 3;
const GALLERY_PAGE_SIZE = 24;

const KIND_ORDER: ReferenceAttachmentKind[] = ["image", "audio", "url", "audit"];

const KIND_NOUN: Record<ReferenceAttachmentKind, [string, string]> = {
  image: ["image", "images"],
  audio: ["audio", "audio"],
  url: ["link", "links"],
  audit: ["audit", "audits"],
};

const STRIP_TOTAL_NOUN: Record<ReferenceAttachmentKind, string> = {
  image: "images",
  audio: "recordings",
  url: "links",
  audit: "audits",
};

const KIND_FILTER_LABEL: Record<ReferenceAttachmentKind, string> = {
  image: "Images",
  audio: "Audio",
  url: "Links",
  audit: "Audits",
};

const KIND_ICON: Record<ReferenceAttachmentKind, typeof Link2> = {
  image: ImageIcon,
  audio: Mic,
  url: Link2,
  audit: ClipboardList,
};

function isImageItem(item: ReferenceItem) {
  return item.kind === "image" && isUploadedImagePath(item.href);
}

function referenceKindSummary(items: readonly ReferenceItem[]): string {
  return KIND_ORDER.map((kind) => {
    const count = items.filter((item) => item.kind === kind).length;
    if (count === 0) return null;
    const [singular, plural] = KIND_NOUN[kind];
    return `${count} ${count === 1 ? singular : plural}`;
  })
    .filter(Boolean)
    .join(" · ");
}

function formatOverflowCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

/* ── Single reference (unchanged presentation) ─────────────────────────── */

function CompactReferenceItem({ href, className }: { href: string; className?: string }) {
  const kind = detectReferenceAttachmentKind(href);
  const label = referenceAttachmentLabel(href);

  if (kind === "image" && isUploadedImagePath(href)) {
    return (
      <div className={cn("audit-ref-view audit-ref-view--compact audit-ref-view--image", className)}>
        <ReferenceImageViewer
          src={href}
          className="audit-ref-view__thumb-btn"
          thumbnailClassName="audit-ref-view__thumb"
        />
        <span className="audit-ref-view__meta">
          <span className="audit-ref-view__meta-title">1 image</span>
          <span className="audit-ref-view__label" title={label}>
            {label}
          </span>
        </span>
      </div>
    );
  }

  if (kind === "audio" && isUploadedAudioPath(href)) {
    return (
      <div className={cn("audit-ref-view audit-ref-view--compact", className)}>
        <span className="audit-ref-view__badge">
          <Mic size={13} aria-hidden />
          Audio
        </span>
        <audio
          controls
          preload="none"
          src={href}
          className="audit-ref-view__audio-mini"
        />
      </div>
    );
  }

  if (kind === "audit" && isAuditReferencePath(href)) {
    const code = auditCodeFromReferencePath(href);
    return (
      <Link
        href={`/audit-logs?search=${encodeURIComponent(code ?? "")}`}
        className={cn("audit-ref-view audit-ref-view--link", className)}
        title={code ?? "Linked audit"}
      >
        <ExternalLink size={13} aria-hidden />
        {code}
      </Link>
    );
  }

  return (
    <span
      className={cn("audit-ref-view audit-ref-view--link audit-ref-view--text", className)}
      title={href}
    >
      <Link2 size={13} aria-hidden />
      <span className="audit-ref-view__label">{label}</span>
    </span>
  );
}

function FullReferenceItem({ href, className }: { href: string; className?: string }) {
  const kind = detectReferenceAttachmentKind(href);

  return (
    <div className={cn("audit-ref-view audit-ref-view--full", className)}>
      <span className="audit-ref-view__kind">
        {kind === "image" ? (
          <>
            <ImageIcon size={14} aria-hidden /> Image
          </>
        ) : kind === "audio" ? (
          <>
            <Mic size={14} aria-hidden /> Audio
          </>
        ) : kind === "audit" ? (
          <>Linked audit</>
        ) : (
          <>
            <Link2 size={14} aria-hidden /> URL
          </>
        )}
      </span>
      {kind === "image" && isUploadedImagePath(href) ? (
        <ReferenceImageViewer src={href} />
      ) : kind === "audio" && isUploadedAudioPath(href) ? (
        <audio controls preload="metadata" src={href} className="audit-ref-view__audio" />
      ) : kind === "audit" && isAuditReferencePath(href) ? (
        <Link
          href={`/audit-logs?search=${encodeURIComponent(
            auditCodeFromReferencePath(href) ?? ""
          )}`}
          className="audit-ref-view--link"
        >
          <ExternalLink size={13} aria-hidden />
          {auditCodeFromReferencePath(href)}
        </Link>
      ) : (
        <a
          href={href.startsWith("http") ? href : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="audit-ref-view--link"
        >
          <ExternalLink size={13} aria-hidden />
          {href}
        </a>
      )}
    </div>
  );
}

/* ── Shared thumbnail (lazy, with broken-file fallback) ────────────────── */

function ReferenceThumb({
  src,
  alt,
  className,
  iconSize = 14,
}: {
  src: string;
  alt: string;
  className?: string;
  iconSize?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className={cn("audit-ref-thumb audit-ref-thumb--broken", className)} aria-hidden>
        <ImageIcon size={iconSize} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn("audit-ref-thumb", className)}
      onError={() => setFailed(true)}
    />
  );
}

/* ── Table strip: up to 3 small tiles + "+N" ───────────────────────────── */

function ReferenceStrip({
  items,
  interactionType,
  className,
}: {
  items: ReferenceItem[];
  interactionType: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const visible = items.slice(0, STRIP_VISIBLE_COUNT);
  const hiddenCount = items.length - visible.length;
  const summary = referenceKindSummary(items);
  const kinds = new Set(items.map((item) => item.kind));
  const singleKind = kinds.size === 1 ? items[0]!.kind : null;
  const totalLabel = `${items.length} ${singleKind ? STRIP_TOTAL_NOUN[singleKind] : "files"}`;
  const detailLabel = !singleKind
    ? summary
    : hiddenCount > 0
      ? `+${hiddenCount.toLocaleString()} more`
      : "View all";

  return (
    <>
      <button
        type="button"
        className={cn("audit-ref-strip", className)}
        title={`View all ${items.length} references — ${summary}`}
        aria-label={`View all ${items.length} references: ${summary}`}
        onClick={() => setOpen(true)}
      >
        <span className="audit-ref-strip__stack" aria-hidden>
          {visible.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <span
                key={item.href}
                className={cn(
                  "audit-ref-strip__tile",
                  `audit-ref-strip__tile--${item.kind}`
                )}
              >
                {isImageItem(item) ? (
                  <ReferenceThumb src={item.href} alt="" className="audit-ref-strip__img" />
                ) : (
                  <Icon size={14} />
                )}
              </span>
            );
          })}
          {hiddenCount > 0 ? (
            <span className="audit-ref-strip__tile audit-ref-strip__more">
              +{formatOverflowCount(hiddenCount)}
            </span>
          ) : null}
        </span>
        <span className="audit-ref-strip__meta" aria-hidden>
          <span className="audit-ref-strip__total">{totalLabel}</span>
          <span className="audit-ref-strip__detail">{detailLabel}</span>
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={interactionReferenceListLabel(
          interactionType,
          items.map((item) => item.kind)
        )}
        description={summary}
        size="lg"
        className="audit-ref-gallery-modal"
      >
        <ReferenceGallery items={items} />
      </Modal>
    </>
  );
}

/* ── Gallery: filters, paged grid, list rows, in-place image viewer ────── */

function GalleryRow({ item }: { item: ReferenceItem }) {
  const { href, kind } = item;
  const label = referenceAttachmentLabel(href);
  const Icon = KIND_ICON[kind];

  if (kind === "audio" && isUploadedAudioPath(href)) {
    return (
      <div className="audit-ref-gallery__row audit-ref-gallery__row--audio">
        <div className="audit-ref-gallery__row-head">
          <span className="audit-ref-gallery__row-icon" aria-hidden>
            <Icon size={13} />
          </span>
          <span className="audit-ref-gallery__row-label" title={label}>
            {label}
          </span>
        </div>
        <audio
          controls
          preload="none"
          src={href}
          className="audit-ref-gallery__audio"
          aria-label={`Play ${label}`}
        />
      </div>
    );
  }

  const content = (
    <>
      <span className="audit-ref-gallery__row-icon" aria-hidden>
        <Icon size={13} />
      </span>
      <span className="audit-ref-gallery__row-label">{label}</span>
      {kind === "audit" || /^https?:\/\//i.test(href) ? (
        <ExternalLink size={12} className="audit-ref-gallery__row-trail" aria-hidden />
      ) : null}
    </>
  );

  if (kind === "audit" && isAuditReferencePath(href)) {
    const code = auditCodeFromReferencePath(href);
    return (
      <Link
        href={`/audit-logs?search=${encodeURIComponent(code ?? "")}`}
        className="audit-ref-gallery__row audit-ref-gallery__row--link"
        title={code ? `Open linked audit ${code}` : "Linked audit"}
      >
        {content}
      </Link>
    );
  }

  if (/^https?:\/\//i.test(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="audit-ref-gallery__row audit-ref-gallery__row--link"
        title={href}
      >
        {content}
      </a>
    );
  }

  return (
    <div className="audit-ref-gallery__row" title={href}>
      {content}
    </div>
  );
}

type GalleryFilter = "all" | ReferenceAttachmentKind;

function ReferenceGallery({ items, className }: { items: ReferenceItem[]; className?: string }) {
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [limit, setLimit] = useState(GALLERY_PAGE_SIZE);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const kindsPresent = KIND_ORDER.filter((kind) =>
    items.some((item) => item.kind === kind)
  );
  const filtered =
    filter === "all" ? items : items.filter((item) => item.kind === filter);
  const shown = filtered.slice(0, limit);
  const shownImages = shown.filter(isImageItem);
  const shownRows = shown.filter((item) => !isImageItem(item));
  const allImages = filtered.filter(isImageItem);
  const remaining = filtered.length - shown.length;
  const current = viewerIndex !== null ? allImages[viewerIndex] : undefined;

  useEffect(() => {
    if (viewerIndex === null) return;
    const total = allImages.length;
    // Capture phase so Escape returns to the grid instead of closing the dialog.
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setViewerIndex(null);
      } else if (event.key === "ArrowLeft") {
        setViewerIndex((index) => (index !== null && index > 0 ? index - 1 : index));
      } else if (event.key === "ArrowRight") {
        setViewerIndex((index) =>
          index !== null && index < total - 1 ? index + 1 : index
        );
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [viewerIndex, allImages.length]);

  function selectFilter(next: GalleryFilter) {
    setFilter(next);
    setLimit(GALLERY_PAGE_SIZE);
    setViewerIndex(null);
  }

  if (current && viewerIndex !== null) {
    const name = fileLabelFromUploadPath(current.href);
    return (
      <div className={cn("audit-ref-gallery audit-ref-gallery--viewer", className)}>
        <div className="audit-ref-gallery__viewer-bar">
          <button
            type="button"
            className="audit-ref-gallery__back"
            onClick={() => setViewerIndex(null)}
          >
            <ArrowLeft size={14} aria-hidden />
            All attachments
          </button>
          <span className="audit-ref-gallery__counter" aria-live="polite">
            {viewerIndex + 1} / {allImages.length}
          </span>
          <a
            href={current.href}
            target="_blank"
            rel="noopener noreferrer"
            className="audit-ref-gallery__open"
          >
            Open original
            <ExternalLink size={12} aria-hidden />
          </a>
        </div>
        <div className="audit-ref-gallery__stage">
          <button
            type="button"
            className="audit-ref-gallery__nav audit-ref-gallery__nav--prev"
            aria-label="Previous image"
            disabled={viewerIndex === 0}
            onClick={() => setViewerIndex(viewerIndex - 1)}
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <ReferenceThumb
            key={current.href}
            src={current.href}
            alt={name}
            className="audit-ref-gallery__full"
            iconSize={32}
          />
          <button
            type="button"
            className="audit-ref-gallery__nav audit-ref-gallery__nav--next"
            aria-label="Next image"
            disabled={viewerIndex >= allImages.length - 1}
            onClick={() => setViewerIndex(viewerIndex + 1)}
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>
        <p className="audit-ref-gallery__caption" title={name}>
          {name}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("audit-ref-gallery", className)}>
      {kindsPresent.length > 1 ? (
        <div className="audit-ref-gallery__filters" role="tablist" aria-label="Filter references">
          {(["all", ...kindsPresent] as GalleryFilter[]).map((option) => {
            const count =
              option === "all"
                ? items.length
                : items.filter((item) => item.kind === option).length;
            return (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={filter === option}
                className={cn(
                  "audit-ref-gallery__filter",
                  filter === option && "audit-ref-gallery__filter--active"
                )}
                onClick={() => selectFilter(option)}
              >
                {option === "all" ? "All" : KIND_FILTER_LABEL[option]}
                <span className="audit-ref-gallery__filter-count">{count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {shownImages.length > 0 ? (
        <div className="audit-ref-gallery__grid">
          {shownImages.map((item) => {
            const name = fileLabelFromUploadPath(item.href);
            return (
              <button
                key={item.href}
                type="button"
                className="audit-ref-gallery__tile"
                title={name}
                aria-label={`View ${name}`}
                onClick={() => setViewerIndex(allImages.indexOf(item))}
              >
                <ReferenceThumb src={item.href} alt="" className="audit-ref-gallery__img" />
              </button>
            );
          })}
        </div>
      ) : null}

      {shownRows.length > 0 ? (
        <ul className="audit-ref-gallery__rows">
          {shownRows.map((item) => (
            <li key={item.href}>
              <GalleryRow item={item} />
            </li>
          ))}
        </ul>
      ) : null}

      {remaining > 0 ? (
        <button
          type="button"
          className="audit-ref-gallery__load-more"
          onClick={() => setLimit((value) => value + GALLERY_PAGE_SIZE)}
        >
          Show {Math.min(remaining, GALLERY_PAGE_SIZE)} more
          <span>
            {shown.length} of {filtered.length}
          </span>
        </button>
      ) : null}
    </div>
  );
}

/* ── Public view ───────────────────────────────────────────────────────── */

export function ReferenceAttachmentView({
  referenceUrl,
  interactionType = "Call",
  variant = "compact",
  className,
}: ReferenceAttachmentViewProps) {
  const items = parseReferenceItems(referenceUrl);

  if (items.length === 0) {
    return variant === "compact" ? (
      <span className={cn("audit-ref-view audit-ref-view--empty", className)}>—</span>
    ) : null;
  }

  if (items.length === 1) {
    return variant === "compact" ? (
      <CompactReferenceItem href={items[0].href} className={className} />
    ) : (
      <FullReferenceItem href={items[0].href} className={className} />
    );
  }

  if (variant === "compact") {
    return (
      <ReferenceStrip
        items={items}
        interactionType={interactionType}
        className={className}
      />
    );
  }

  return <ReferenceGallery items={items} className={className} />;
}

export function referenceAttachmentSearchText(
  referenceUrl: string | null | undefined
): string {
  return parseReferenceItems(referenceUrl)
    .map((item) => referenceAttachmentLabel(item.href))
    .join(" ");
}
