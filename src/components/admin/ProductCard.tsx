import React, { useState, useRef, useEffect } from 'react';
import {
  MoreHorizontal,
  Edit2,
  Trash2,
  QrCode,
  Lightbulb,
  Fan,
  Droplets,
  DoorClosed,
  Wind,
  Thermometer,
  Radio,
  Flame,
  Camera,
  Cpu,
  Layers,
} from 'lucide-react';
import type { DeviceCatalog } from '../../types/deviceCatalog';

export interface ProductCardProps {
  catalog: DeviceCatalog;
  onEdit: (catalog: DeviceCatalog) => void;
  onDelete: (catalog: DeviceCatalog) => void;
  onGenerateQr: (catalog: DeviceCatalog) => void;
}

export function getFriendlyDeviceTypeName(deviceType: string): string {
  switch (deviceType) {
    case 'LED_RGB':
      return 'Đèn LED RGB';
    case 'LIGHT':
      return 'Công tắc / Đèn relay';
    case 'SMART_PLUG':
      return 'Ổ cắm đo điện';
    case 'FAN':
      return 'Quạt thông minh';
    case 'WATER_PUMP':
      return 'Máy bơm nước';
    case 'GATE_MOTOR':
      return 'Motor cổng tự động';
    case 'AC_REMOTE':
      return 'Điều khiển điều hòa';
    case 'TEMP_HUMID_SENSOR':
      return 'Cảm biến nhiệt ẩm';
    case 'MOTION_SENSOR':
      return 'Cảm biến chuyển động';
    case 'SMOKE_SENSOR':
      return 'Cảm biến báo khói';
    case 'LUX_SENSOR':
      return 'Cảm biến ánh sáng';
    case 'IR_REMOTE':
      return 'Điều khiển hồng ngoại';
    case 'CAMERA_AI':
      return 'Camera AI';
    default:
      return deviceType;
  }
}

export function DeviceTypeFallbackIcon({ deviceType }: { deviceType: string }) {
  const iconProps = { className: 'w-10 h-10 text-icon/60', 'aria-hidden': true };
  switch (deviceType) {
    case 'LED_RGB':
    case 'LIGHT':
      return <Lightbulb {...iconProps} />;
    case 'SMART_PLUG':
      return <Cpu {...iconProps} />;
    case 'FAN':
      return <Fan {...iconProps} />;
    case 'WATER_PUMP':
      return <Droplets {...iconProps} />;
    case 'GATE_MOTOR':
      return <DoorClosed {...iconProps} />;
    case 'AC_REMOTE':
      return <Wind {...iconProps} />;
    case 'TEMP_HUMID_SENSOR':
      return <Thermometer {...iconProps} />;
    case 'MOTION_SENSOR':
      return <Radio {...iconProps} />;
    case 'SMOKE_SENSOR':
      return <Flame {...iconProps} />;
    case 'CAMERA_AI':
      return <Camera {...iconProps} />;
    default:
      return <Layers {...iconProps} />;
  }
}

export const ProductCard: React.FC<ProductCardProps> = ({
  catalog,
  onEdit,
  onDelete,
  onGenerateQr,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, [menuOpen]);

  const total = catalog.totalDeviceCount || 0;
  const claimed = catalog.claimedCount || 0;
  const unclaimed = catalog.unclaimedCount || 0;
  const claimedPercent = total > 0 ? Math.round((claimed / total) * 100) : 0;
  const hasValidImage = Boolean(catalog.imageUrl && !imageError);

  return (
    <article
      data-testid="product-card"
      className="surface-card glass-g1 rounded-[20px] p-4 border border-line bg-surface/90 backdrop-blur-md shadow-xs hover:shadow-soft transition-all duration-200 flex flex-col justify-between h-full group"
    >
      <div>
        {/* Product Image Area with 16:10 aspect ratio */}
        <div className="relative mb-3.5 h-44 w-full overflow-hidden rounded-2xl border border-line bg-sidebar/40 p-2 flex items-center justify-center">
          {hasValidImage ? (
            <img
              src={catalog.imageUrl}
              alt={catalog.name}
              onError={() => setImageError(true)}
              className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div
              data-testid="product-placeholder"
              className="h-full w-full flex items-center justify-center"
            >
              <DeviceTypeFallbackIcon deviceType={catalog.deviceType} />
            </div>
          )}

          {/* Neutral badges on image container */}
          <div className="absolute top-2.5 left-2.5 z-10">
            <span
              data-testid="product-model-code"
              className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-mono font-medium border border-line bg-surface/90 text-text shadow-2xs backdrop-blur-xs"
            >
              {catalog.modelCode}
            </span>
          </div>

          <div className="absolute top-2.5 right-2.5 z-10">
            <span
              data-testid="product-device-type"
              className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium border border-line bg-surface/90 text-muted shadow-2xs backdrop-blur-xs"
            >
              {getFriendlyDeviceTypeName(catalog.deviceType)}
            </span>
          </div>
        </div>

        {/* Title, Prefix and Description */}
        <div className="space-y-1">
          <h3
            data-testid="product-name"
            title={catalog.name}
            className="text-base font-semibold text-text line-clamp-2 leading-snug group-hover:text-primary transition-colors"
          >
            {catalog.name}
          </h3>

          <p className="text-xs font-mono text-muted">
            Tiền tố: <span className="font-semibold text-text">{catalog.serialPrefix || `${catalog.modelCode}-`}</span>xxxx
          </p>

          <p
            data-testid="product-description"
            className="text-xs text-muted pt-1 line-clamp-2 leading-relaxed"
          >
            {catalog.description?.trim() ? (
              catalog.description
            ) : (
              <span className="text-muted/60 italic">Chưa có mô tả</span>
            )}
          </p>
        </div>

        {/* Output Stats Summary */}
        <div className="mt-4 pt-3 border-t border-line space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Sản lượng đã tạo:</span>
            <span className="font-semibold text-text">{total} chiếc</span>
          </div>

          <div
            className="h-1.5 w-full rounded-full bg-sidebar overflow-hidden flex"
            role="progressbar"
            aria-valuenow={claimedPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Tiến độ kích hoạt: ${claimedPercent}%`}
          >
            <div
              style={{ width: `${claimedPercent}%` }}
              className="bg-primary h-full transition-all"
              title={`Đã ghép: ${claimed}`}
            />
            <div
              style={{ width: `${100 - claimedPercent}%` }}
              className="bg-line h-full transition-all"
              title={`Chờ kích hoạt: ${unclaimed}`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>
              Chờ kích hoạt: <strong className="font-medium text-text">{unclaimed}</strong>
            </span>
            <span>
              Đã ghép: <strong className="font-medium text-text">{claimed}</strong> ({claimedPercent}%)
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-2">
        {/* Overflow Menu: Chỉnh sửa & Xóa */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-label={`Thao tác cho dòng sản phẩm ${catalog.name}`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
            className="p-2 rounded-xl text-muted hover:text-text hover:bg-sidebar transition-colors cursor-pointer"
            title="Thao tác khác"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute left-0 bottom-full mb-1 z-30 w-44 rounded-2xl border border-line bg-surface p-1 shadow-lg animate-in fade-in zoom-in-95 duration-150"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(catalog);
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-text hover:bg-surface-hover rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-muted" />
                <span>Chỉnh sửa</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(catalog);
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Xóa dòng sản phẩm</span>
              </button>
            </div>
          )}
        </div>

        {/* Primary Visible Action: Tạo mã QR */}
        <button
          type="button"
          onClick={() => onGenerateQr(catalog)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-surface hover:bg-surface-hover hover:border-primary/50 text-xs font-semibold text-text shadow-2xs transition-colors cursor-pointer active:scale-98"
        >
          <QrCode className="w-3.5 h-3.5 text-primary" />
          <span>Tạo mã QR</span>
        </button>
      </div>
    </article>
  );
};
