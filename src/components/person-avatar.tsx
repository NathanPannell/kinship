"use client";

import { useState } from "react";
import { initials } from "./crm-utils";

export function PersonAvatar({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  className: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = Boolean(photoUrl && failedUrl === photoUrl);

  return (
    <span className={className} aria-hidden="true">
      {photoUrl && !failed ? (
        // User-provided remote images are intentionally rendered without a referrer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="person-avatar-image"
          src={photoUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(photoUrl ?? null)}
        />
      ) : initials(name)}
    </span>
  );
}
