/**
 * Chuyển đổi ảnh WebP sang JPEG trên trình duyệt qua <canvas> trước khi upload
 * (giúp ImageSanitizer backend hỗ trợ đầy đủ và loại bỏ EXIF phía client).
 * Nếu chuyển thất bại hoặc không phải WebP, trả lại file gốc bình thường.
 */
export async function convertWebpToJpegIfNeeded(file: File): Promise<File> {
  if (file.type !== 'image/webp' || typeof document === 'undefined' || typeof URL === 'undefined') {
    return file;
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Không đọc được ảnh WebP'));
      el.src = objectUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return file;
    const nextName = file.name.replace(/\.webp$/i, '.jpg');
    return new File([blob], nextName.endsWith('.jpg') ? nextName : `${nextName}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
