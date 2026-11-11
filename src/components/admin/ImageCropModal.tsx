import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Crop, ZoomIn, ZoomOut, RotateCw, Check, X, RefreshCw } from 'lucide-react';

interface ImageCropModalProps {
  imageSrc: string;
  onCropComplete: (file: File) => void;
  onClose: () => void;
}

type AspectRatio = '16:9' | '4:3' | '1:1';

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  imageSrc,
  onCropComplete,
  onClose,
}) => {
  const [aspect, setAspect] = useState<AspectRatio>('16:9');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const getAspectDimensions = () => {
    switch (aspect) {
      case '16:9':
        return { width: 440, height: 248 };
      case '4:3':
        return { width: 400, height: 300 };
      case '1:1':
        return { width: 320, height: 320 };
    }
  };

  const cropBox = getAspectDimensions();

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    setImageLoaded(true);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((prev) => Math.min(Math.max(0.5, prev + delta), 3));
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  const handleConfirmCrop = () => {
    if (!imgRef.current || !imageLoaded) return;

    const img = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Export resolution
    const targetWidth = aspect === '1:1' ? 800 : aspect === '4:3' ? 800 : 880;
    const targetHeight = aspect === '1:1' ? 800 : aspect === '4:3' ? 600 : 495;

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Scale from preview cropBox to actual export canvas
    const scaleFactor = targetWidth / cropBox.width;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    ctx.save();
    // Center to canvas
    ctx.translate(targetWidth / 2, targetHeight / 2);

    // Apply pan & zoom from viewport scaled to export resolution
    ctx.translate(pan.x * scaleFactor, pan.y * scaleFactor);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom * scaleFactor, zoom * scaleFactor);

    // Draw image centered
    const baseW = cropBox.width;
    const baseH = (imageSize.height / (imageSize.width || 1)) * baseW;
    ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH);

    ctx.restore();

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `product-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCropComplete(file);
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-3xl border border-line bg-surface p-6 shadow-float transition-all">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Crop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text">Cắt Xén &amp; Căn Chỉnh Ảnh</h3>
              <p className="text-xs text-muted">Kéo để di chuyển, dùng thanh trượt để phóng to / thu nhỏ chủ thể</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted hover:bg-surface-hover hover:text-text transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Aspect Ratio Selector */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted">Tỉ lệ khung hình:</span>
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(['16:9', '4:3', '1:1'] as AspectRatio[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setAspect(r);
                  setPan({ x: 0, y: 0 });
                }}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  aspect === r
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-muted hover:text-text'
                }`}
              >
                {r === '16:9' ? '16:9 (Chuẩn Thẻ)' : r === '4:3' ? '4:3' : '1:1 (Vuông)'}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Viewport */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          className="relative mx-auto flex items-center justify-center overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 select-none cursor-grab active:cursor-grabbing"
          style={{ width: '100%', height: 320 }}
        >
          {/* Active Image */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop Target"
            crossOrigin="anonymous"
            onLoad={handleImageLoad}
            style={{
              width: cropBox.width,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.05s ease-out',
            }}
            className="pointer-events-none max-w-none"
          />

          {/* Vignette / Cutout Frame Overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {/* The visible crop window */}
            <div
              style={{ width: cropBox.width, height: cropBox.height }}
              className="relative border-2 border-amber-400 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]"
            >
              {/* Grid Lines (Rule of thirds) */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                <div className="border-r border-b border-white/50" />
                <div className="border-r border-b border-white/50" />
                <div className="border-b border-white/50" />
                <div className="border-r border-b border-white/50" />
                <div className="border-r border-b border-white/50" />
                <div className="border-b border-white/50" />
                <div className="border-r border-white/50" />
                <div className="border-r border-white/50" />
                <div />
              </div>
            </div>
          </div>
        </div>

        {/* Controls Bar: Zoom Slider + Rotate + Reset */}
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.max(0.5, prev - 0.1))}
              className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface-hover cursor-pointer"
              title="Thu nhỏ"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-1.5 rounded-lg bg-slate-200 dark:bg-slate-700"
            />
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.min(3, prev + 0.1))}
              className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface-hover cursor-pointer"
              title="Phóng to"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-muted w-10 text-right">{Math.round(zoom * 100)}%</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
              className="p-2 rounded-xl border border-line bg-surface hover:bg-surface-hover text-text text-xs flex items-center gap-1 cursor-pointer transition-colors"
              title="Xoay 90 độ"
            >
              <RotateCw className="w-4 h-4 text-muted" />
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="p-2 rounded-xl border border-line bg-surface hover:bg-surface-hover text-text text-xs flex items-center gap-1 cursor-pointer transition-colors"
              title="Đặt lại khung"
            >
              <RefreshCw className="w-4 h-4 text-muted" />
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 flex items-center justify-end gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-line text-xs font-semibold text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
          >
            Hủy Bỏ
          </button>
          <button
            type="button"
            onClick={handleConfirmCrop}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-soft transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Áp Dụng &amp; Tải Lên</span>
          </button>
        </div>
      </div>
    </div>
  );
};
