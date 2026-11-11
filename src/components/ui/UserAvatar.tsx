import { useState } from 'react';

interface UserAvatarProps {
  src?: string | null;
  name: string;
  size: number;
  className?: string;
  fallbackClassName?: string;
  loading?: 'eager' | 'lazy';
}

export function UserAvatar({
  src,
  name,
  size,
  className = '',
  fallbackClassName = '',
  loading = 'eager',
}: UserAvatarProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const showImage = Boolean(src && failedSource !== src);
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
      }}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`}
    >
      {showImage ? (
        <img
          src={src!}
          alt={`Ảnh đại diện của ${name}`}
          width={size}
          height={size}
          loading={loading}
          className="h-full w-full object-cover rounded-full"
          onError={() => setFailedSource(src!)}
        />
      ) : (
        <span
          className={`flex h-full w-full items-center justify-center select-none font-bold ${fallbackClassName}`}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
