"use client";

import { useState } from "react";
import { Expand, X } from "lucide-react";
import { Modal } from "@/components/primitives/modal";
import { fileLabelFromUploadPath } from "@/lib/upload/reference-url-paths";
import { cn } from "@/lib/utils";

type ReferenceImageViewerProps = {
  src: string;
  alt?: string;
  filename?: string;
  className?: string;
  thumbnailClassName?: string;
};

export function ReferenceImageViewer({
  src,
  alt = "Chat reference image",
  filename,
  className,
  thumbnailClassName,
}: ReferenceImageViewerProps) {
  const [open, setOpen] = useState(false);
  const label = filename ?? fileLabelFromUploadPath(src);

  return (
    <>
      <button
        type="button"
        className={cn("audit-reference-image", className)}
        onClick={() => setOpen(true)}
        aria-label={`View full image: ${label}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className={cn("audit-reference-image__thumb", thumbnailClassName)}
        />
        <span className="audit-reference-image__overlay">
          <Expand size={18} aria-hidden />
          <span>View full image</span>
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        description="Chat reference attachment"
        className="audit-reference-image-modal"
      >
        <div className="audit-reference-image-modal__frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="audit-reference-image-modal__full"
          />
        </div>
        <div className="audit-reference-image-modal__actions">
          <button
            type="button"
            className="ui-btn ui-btn--secondary ui-btn--sm"
            onClick={() => setOpen(false)}
          >
            <X size={16} aria-hidden />
            Close
          </button>
        </div>
      </Modal>
    </>
  );
}
