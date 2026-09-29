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
  className = 'h-full w-full object-cover',
  fallbackClassName = '',
  loading = 'eager',
}: UserAvatarProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const showImage = Boolean(src && failedSource !== src);
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  if (!showImage) {
    return <span className={fallbackClassName}>{initial}</span>;
  }

  return (
    <img
      src={src!}
      alt={`Ảnh đại diện của ${name}`}
      width={size}
      height={size}
      loading={loading}
      className={className}
      onError={() => setFailedSource(src!)}
    />
  );
}
