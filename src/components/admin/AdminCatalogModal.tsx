import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Image as ImageIcon, Layers, Tag, Hash, AlignLeft, UploadCloud, Trash2, Loader2, Crop } from 'lucide-react';
import type { DeviceCatalog, DeviceCatalogRequest } from '../../types/deviceCatalog';
import { createDeviceCatalog, updateDeviceCatalog, uploadDeviceCatalogImage } from '../../services/deviceCatalogApi';
import { ImageCropModal } from './ImageCropModal';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';

interface AdminCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingCatalog: DeviceCatalog | null;
}

const DEVICE_TYPES = [
  { value: 'LED_RGB', label: 'Đèn LED RGB (LED_RGB)', prefix: 'HESTA-RGB-', icon: 'lightbulb' },
  { value: 'LIGHT', label: 'Công Tắc / Đèn Relay (LIGHT)', prefix: 'HESTA-SW-', icon: 'toggle-left' },
  { value: 'SMART_PLUG', label: 'Ổ Cắm Đo Điện (SMART_PLUG)', prefix: 'HESTA-PLUG-', icon: 'plug' },
  { value: 'FAN', label: 'Quạt Thông Minh (FAN)', prefix: 'HESTA-FAN-', icon: 'fan' },
  { value: 'WATER_PUMP', label: 'Máy Bơm Nước (WATER_PUMP)', prefix: 'HESTA-PUMP-', icon: 'droplet' },
  { value: 'GATE_MOTOR', label: 'Motor Cổng Tự Động (GATE_MOTOR)', prefix: 'HESTA-GATE-', icon: 'door-closed' },
  { value: 'AC_REMOTE', label: 'Điều Khiển Điều Hòa (AC_REMOTE)', prefix: 'HESTA-AC-', icon: 'wind' },
  { value: 'TEMP_HUMID_SENSOR', label: 'Cảm Biến Nhiệt Ẩm (TEMP_HUMID_SENSOR)', prefix: 'HESTA-TH-', icon: 'thermometer' },
  { value: 'MOTION_SENSOR', label: 'Cảm Biến Chuyển Động (MOTION_SENSOR)', prefix: 'HESTA-PIR-', icon: 'radar' },
  { value: 'SMOKE_SENSOR', label: 'Cảm Biến Báo Khói (SMOKE_SENSOR)', prefix: 'HESTA-SMOKE-', icon: 'flame' },
  { value: 'LUX_SENSOR', label: 'Cảm Biến Ánh Sáng (LUX_SENSOR)', prefix: 'HESTA-LUX-', icon: 'sun' },
  { value: 'IR_REMOTE', label: 'Bộ Điều Khiển Hồng Ngoại (IR_REMOTE)', prefix: 'HESTA-IR-', icon: 'remote' },
  { value: 'CAMERA_AI', label: 'Camera Giám Sát AI (CAMERA_AI)', prefix: 'HESTA-CAM-', icon: 'camera' },
];

export const AdminCatalogModal: React.FC<AdminCatalogModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingCatalog,
}) => {
  const [formData, setFormData] = useState<DeviceCatalogRequest>({
    name: '',
    deviceType: 'LED_RGB',
    modelCode: '',
    serialPrefix: 'HESTA-RGB-',
    description: '',
    imageUrl: '',
    icon: 'lightbulb',
  });
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCatalog) {
      setFormData({
        name: editingCatalog.name,
        deviceType: editingCatalog.deviceType,
        modelCode: editingCatalog.modelCode,
        serialPrefix: editingCatalog.serialPrefix,
        description: editingCatalog.description || '',
        imageUrl: editingCatalog.imageUrl || '',
        icon: editingCatalog.icon || '',
        defaultCapabilities: editingCatalog.defaultCapabilities,
      });
    } else {
      setFormData({
        name: '',
        deviceType: 'LED_RGB',
        modelCode: 'HESTA-RGB-01',
        serialPrefix: 'HESTA-RGB-',
        description: '',
        imageUrl: '',
        icon: 'lightbulb',
      });
    }
  }, [editingCatalog, isOpen]);

  if (!isOpen) return null;

  const handleDeviceTypeChange = (type: string) => {
    const matched = DEVICE_TYPES.find((d) => d.value === type);
    const prefix = matched ? matched.prefix : 'HESTA-DEV-';
    const suggestedModel = matched ? `${matched.prefix.replace(/-$/, '')}-01` : 'HESTA-DEV-01';

    setFormData((prev) => ({
      ...prev,
      deviceType: type,
      serialPrefix: prefix,
      modelCode: editingCatalog ? prev.modelCode : suggestedModel,
      icon: matched?.icon || 'cpu',
    }));
  };

  const processSelectedFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      notify.error('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP)', '');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      notify.error('Dung lượng ảnh tối đa là 5MB', '');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleCropComplete = async (croppedFile: File) => {
    setCropImageSrc(null);
    setUploadingImage(true);
    try {
      const secureUrl = await uploadDeviceCatalogImage(croppedFile);
      setFormData((prev) => ({ ...prev, imageUrl: secureUrl }));
      notify.success('Đã tải và lưu ảnh sản phẩm thành công!', '');
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không thể tải ảnh lên hệ thống'), '');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleReCrop = () => {
    if (formData.imageUrl) {
      setCropImageSrc(formData.imageUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingCatalog) {
        await updateDeviceCatalog(editingCatalog.id, formData);
        notify.success('Cập nhật mẫu sản phẩm thành công!', '');
      } else {
        await createDeviceCatalog(formData);
        notify.success('Thêm mẫu sản phẩm mới thành công!', '');
      }
      onSuccess();
      onClose();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Thao tác không thành công'), '');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
        <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-line bg-surface p-6 shadow-float transition-all sm:p-8">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Header */}
          <div className="mb-6 flex items-center justify-between border-b border-line pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text">
                  {editingCatalog ? 'Chỉnh Sửa Mẫu Sản Phẩm' : 'Thêm Dòng Sản Phẩm Mới'}
                </h2>
                <p className="text-xs text-muted">
                  {editingCatalog
                    ? `Cập nhật thông tin định danh cho model ${editingCatalog.modelCode}`
                    : 'Định nghĩa SKU phần cứng trong danh mục để tạo mã QR hàng loạt'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-muted hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-text transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-primary" />
                Tên Dòng Sản Phẩm
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="VD: Đèn LED RGB HESTA Aura"
                className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-text focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" />
                Loại Thiết Bị (Device Type)
              </label>
              <select
                value={formData.deviceType}
                onChange={(e) => handleDeviceTypeChange(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-text focus:border-primary focus:outline-none"
              >
                {DEVICE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-primary" />
                  Mã Model (Model Code)
                </label>
                <input
                  type="text"
                  required
                  value={formData.modelCode}
                  onChange={(e) => setFormData({ ...formData, modelCode: e.target.value.toUpperCase() })}
                  placeholder="VD: HESTA-RGB-01"
                  className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-mono text-text focus:border-primary focus:outline-none"
                />
                <span className="text-[11px] text-muted">Mã duy nhất nhận diện dòng máy</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Tiền Tố Sê-ri (Prefix)
                </label>
                <input
                  type="text"
                  required
                  value={formData.serialPrefix}
                  onChange={(e) => setFormData({ ...formData, serialPrefix: e.target.value })}
                  placeholder="VD: HESTA-RGB-"
                  className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-mono text-text focus:border-primary focus:outline-none"
                />
                <span className="text-[11px] text-muted">Đuôi số sê-ri sẽ tự tăng (-0001, -0002)</span>
              </div>
            </div>

            {/* Clean Image Upload Section */}
            <div>
              <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-primary" />
                Hình Ảnh Sản Phẩm
              </label>

              {formData.imageUrl ? (
                <div className="relative rounded-2xl border border-line bg-slate-50 dark:bg-slate-900/40 p-3 overflow-hidden">
                  <div className="relative h-44 w-full flex items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                    <img
                      src={formData.imageUrl}
                      alt="Product Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                    {uploadingImage && (
                      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white">
                        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                        <span className="text-xs font-semibold">Đang xử lý &amp; lưu ảnh...</span>
                      </div>
                    )}
                  </div>

                  {!uploadingImage && (
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleReCrop}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-surface hover:bg-surface-hover text-xs font-semibold text-text shadow-xs transition-colors cursor-pointer"
                        title="Cắt xén hoặc căn chỉnh lại vị trí ảnh"
                      >
                        <Crop className="w-3.5 h-3.5 text-amber-500" />
                        <span>Cắt xén</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-surface hover:bg-surface-hover text-xs font-semibold text-text shadow-xs transition-colors cursor-pointer"
                        title="Chọn tệp ảnh khác từ máy tính"
                      >
                        <UploadCloud className="w-3.5 h-3.5 text-primary" />
                        <span>Đổi ảnh khác</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, imageUrl: '' }))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/30 text-rose-600 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors cursor-pointer"
                        title="Xóa ảnh"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingFile(true);
                  }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={handleDrop}
                  className={`rounded-2xl border-2 border-dashed p-6 transition-all text-center cursor-pointer ${
                    isDraggingFile
                      ? 'border-amber-500 bg-amber-500/5'
                      : 'border-line hover:border-amber-500/50 bg-surface/40 hover:bg-surface/80'
                  }`}
                >
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
                    {uploadingImage ? (
                      <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                    ) : (
                      <UploadCloud className="w-6 h-6 text-amber-500" />
                    )}
                  </div>
                  <p className="text-sm font-bold text-text">
                    {uploadingImage ? 'Đang tải lên...' : 'Nhấp hoặc kéo thả ảnh từ máy tính'}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    Hỗ trợ PNG, JPG, WebP (Tối đa 5MB) • Cho phép cắt xén tùy ý
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <AlignLeft className="w-3.5 h-3.5 text-primary" />
                Mô Tả Sản Phẩm
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ghi chú chi tiết về thông số kỹ thuật, bảo hành, ghi chú đóng gói..."
                className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-text focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading || uploadingImage}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-all shadow-soft cursor-pointer disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-950" />}
                <span>{editingCatalog ? 'Lưu Thay Đổi' : 'Tạo Dòng Sản Phẩm'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Interactive Cropper Modal */}
      {cropImageSrc && (
        <ImageCropModal
          imageSrc={cropImageSrc}
          onCropComplete={handleCropComplete}
          onClose={() => setCropImageSrc(null)}
        />
      )}
    </>
  );
};
