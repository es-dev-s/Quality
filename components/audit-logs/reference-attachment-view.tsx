"use client";

import Link from "next/link";
import { ExternalLink, ImageIcon, Link2, Mic } from "lucide-react";
import { ReferenceImageViewer } from "@/components/forms/reference-image-viewer";
import {
  auditCodeFromReferencePath,
  detectReferenceAttachmentKind,
  isAuditReferencePath,
  isUploadedAudioPath,
  isUploadedImagePath,
  normalizeUploadedReferencePath,
  referenceAttachmentLabel,
} from "@/lib/upload/reference-url-paths";
import { cn } from "@/lib/utils";

type ReferenceAttachmentViewProps = {
  referenceUrl: string | null | undefined;
  interactionType?: string;
  variant?: "compact" | "full";
  className?: string;
};

export function ReferenceAttachmentView({
  referenceUrl,
  interactionType = "Call",
  variant = "compact",
  className,
}: ReferenceAttachmentViewProps) {
  const raw = referenceUrl?.trim();
  if (!raw) {
    return variant === "compact" ? (
      <span className={cn("audit-ref-view audit-ref-view--empty", className)}>—</span>
    ) : null;
  }

  const href = normalizeUploadedReferencePath(raw);
  const kind = detectReferenceAttachmentKind(href);
  const label = referenceAttachmentLabel(href);

  if (variant === "compact") {
    if (kind === "image" && isUploadedImagePath(href)) {
      return (
        <div className={cn("audit-ref-view audit-ref-view--compact", className)}>
          <ReferenceImageViewer
            src={href}
            thumbnailClassName="audit-ref-view__thumb"
          />
          <span className="audit-ref-view__label" title={label}>
            {label}
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

export function referenceAttachmentSearchText(
  referenceUrl: string | null | undefined
): string {
  if (!referenceUrl?.trim()) return "";
  return referenceAttachmentLabel(normalizeUploadedReferencePath(referenceUrl));
}
