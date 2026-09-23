"use client";

import { useState } from "react";
import { initials } from "./crm-utils";

export function PersonAvatar({
  contactId,
  name,
  photoUrl,
  uploadedPhotoUpdatedAt,
  className,
}: {
  contactId: string;
  name: string;
  photoUrl?: string | null;
  uploadedPhotoUpdatedAt?: string | null;
  className: string;
}) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const uploadedPhotoUrl = uploadedPhotoUpdatedAt
    ? `/api/contacts/${contactId}/photo?v=${encodeURIComponent(uploadedPhotoUpdatedAt)}`
    : null;
  const photoSource = (uploadedPhotoUrl && !failedUrls.has(uploadedPhotoUrl) ? uploadedPhotoUrl : null)
    ?? (photoUrl && !failedUrls.has(photoUrl) ? photoUrl : null);

  return (
    <span className={className} aria-hidden="true">
      {photoSource ? (
        // Keep referrer information out of image requests.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="person-avatar-image"
          src={photoSource}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrls((current) => new Set(current).add(photoSource))}
        />
      ) : initials(name)}
    </span>
  );
}
