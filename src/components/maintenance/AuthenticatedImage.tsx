import { useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

function resolveAttachmentUrl(src: string): string {
  if (/^https?:\/\//i.test(src) || src.startsWith('blob:') || src.startsWith('data:')) {
    return src;
  }
  const origin = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  return `${origin}${src.startsWith('/') ? src : `/${src}`}`;
}

interface AuthenticatedImageProps {
  src: string;
  alt: string;
  className?: string;
  openOnClick?: boolean;
}

/**
 * Tải ảnh bảo trì qua endpoint backend có xác thực JWT (fetch blob + Object URL)
 * để không cần phát hành signed URL Cloudinary dài hạn cho client.
 */
export function AuthenticatedImage({ src, alt, className, openOnClick }: AuthenticatedImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    setFailed(false);
    const resolved = resolveAttachmentUrl(src);
    const token = localStorage.getItem('accessToken');

    fetch(resolved, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [src]);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-sidebar text-[11px] text-muted ${className ?? ''}`}>
        Không tải được ảnh
      </div>
    );
  }

  if (!blobUrl) {
    return <div className={`animate-pulse bg-sidebar ${className ?? ''}`} aria-busy="true" />;
  }

  const img = <img src={blobUrl} alt={alt} className={className} />;
  if (openOnClick) {
    return (
      <a href={blobUrl} target="_blank" rel="noreferrer" className="block w-full h-full">
        {img}
      </a>
    );
  }
  return img;
}
