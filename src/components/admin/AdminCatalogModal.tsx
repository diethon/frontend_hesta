import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  UploadCloud,
  Trash2,
  Loader2,
  Crop,
  ChevronDown,
} from 'lucide-react';
import type { DeviceCatalog, DeviceCatalogRequest } from '../../types/deviceCatalog';
import { createDeviceCatalog, updateDeviceCatalog, uploadDeviceCatalogImage } from '../../services/deviceCatalogApi';
import { ImageCropModal } from './ImageCropModal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';
import { CATALOG_DEVICE_TYPES, isCatalogFormDirty } from './adminCatalogHelpers';

export interface AdminCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingCatalog: DeviceCatalog | null;
}

export const AdminCatalogModal: React.FC<AdminCatalogModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingCatalog,
}) => {
  const getInitialFormData = useCallback((): DeviceCatalogRequest => {
    if (editingCatalog) {
      return {
        name: editingCatalog.name || '',
        deviceType: editingCatalog.deviceType || 'LED_RGB',
        modelCode: editingCatalog.modelCode || '',
        serialPrefix: editingCatalog.serialPrefix || '',
        description: editingCatalog.description || '',
        imageUrl: editingCatalog.imageUrl || '',
        icon: editingCatalog.icon || 'lightbulb',
        defaultCapabilities: editingCatalog.defaultCapabilities,
      };
    }
    return {
      name: '',
      deviceType: 'LED_RGB',
      modelCode: 'HESTA-RGB-01',
      serialPrefix: 'HESTA-RGB-',
      description: '',
      imageUrl: '',
      icon: 'lightbulb',
    };
  }, [editingCatalog]);

  const [formData, setFormData] = useState<DeviceCatalogRequest>(getInitialFormData);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [deviceTypeDropdownOpen, setDeviceTypeDropdownOpen] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Synchronize when editingCatalog changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen) return;
    const initial = getInitialFormData();
    setFormData(initial);
    setShowDiscardConfirm(false);
    setDeviceTypeDropdownOpen(false);
  }, [editingCatalog, isOpen, getInitialFormData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Check if form has unsaved edits
  const isDirty = useMemo(() => {
    const initial = getInitialFormData();
    return isCatalogFormDirty(formData, initial);
  }, [formData, getInitialFormData]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDeviceTypeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Validation rules
  const isNameValid = Boolean(formData.name.trim());
  const isModelValid = Boolean(formData.modelCode.trim());
  const isPrefixValid = Boolean(formData.serialPrefix.trim());
  const isValid = isNameValid && isModelValid && isPrefixValid;

  const validationHint = useMemo(() => {
    if (!isNameValid) return 'Vui lòng nhập tên dòng sản phẩm';
    if (!isModelValid) return 'Vui lòng nhập mã model';
    if (!isPrefixValid) return 'Vui lòng nhập tiền tố sê-ri';
    return null;
  }, [isNameValid, isModelValid, isPrefixValid]);

  // Handle closing attempts with dirty check
  const handleAttemptClose = useCallback(() => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  // Handle Esc key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (cropImageSrc) {
          setCropImageSrc(null);
        } else if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
        } else if (deviceTypeDropdownOpen) {
          setDeviceTypeDropdownOpen(false);
        } else {
          handleAttemptClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, cropImageSrc, showDiscardConfirm, deviceTypeDropdownOpen, handleAttemptClose]);

  if (!isOpen) return null;

  const handleDeviceTypeChange = (type: string) => {
    const matched = CATALOG_DEVICE_TYPES.find((d) => d.value === type);
    const prefix = matched ? matched.prefix : 'HESTA-DEV-';
    const suggestedModel = matched ? `${matched.prefix.replace(/-$/, '')}-01` : 'HESTA-DEV-01';

    setFormData((prev) => ({
      ...prev,
      deviceType: type,
      serialPrefix: prefix,
      modelCode: editingCatalog ? prev.modelCode : suggestedModel,
      icon: matched?.icon || 'lightbulb',
    }));
    setDeviceTypeDropdownOpen(false);
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
      notify.success('Đã tải và lưu ảnh sản phẩm thành công', '');
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
    if (!isValid || loading || uploadingImage) return;

    setLoading(true);
    try {
      if (editingCatalog) {
        await updateDeviceCatalog(editingCatalog.id, formData);
        notify.success('Cập nhật dòng sản phẩm thành công', '');
      } else {
        await createDeviceCatalog(formData);
        notify.success('Thêm dòng sản phẩm mới thành công', '');
      }
      onSuccess();
      onClose();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Thao tác không thành công'), '');
    } finally {
      setLoading(false);
    }
  };

  const currentType = CATALOG_DEVICE_TYPES.find((t) => t.value === formData.deviceType);
  const currentTypeDisplay = currentType
    ? `${currentType.label} (${currentType.value})`
    : formData.deviceType;

  const exampleSerial = formData.serialPrefix
    ? `${formData.serialPrefix.replace(/-+$/, '')}-0001`
    : `${formData.modelCode || 'HESTA-DEV'}-0001`;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-dialog-title"
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={handleAttemptClose}
      >
        <div
          data-testid="admin-catalog-modal"
          className="surface-card glass-g2 w-full max-w-[480px] max-h-[92vh] sm:max-h-[85vh] rounded-t-[28px] sm:rounded-3xl border border-line bg-surface flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Sticky Header */}
          <div className="sticky top-0 z-10 px-5 py-4 border-b border-line bg-surface/95 backdrop-blur-md flex items-center justify-between shrink-0">
            <div className="min-w-0 pr-3">
              <h2 id="catalog-dialog-title" className="text-base font-bold text-text truncate">
                {editingCatalog ? 'Chỉnh sửa dòng sản phẩm' : 'Thêm dòng sản phẩm mới'}
              </h2>
              <p className="text-xs text-muted mt-0.5 truncate">
                {editingCatalog
                  ? `Cập nhật thông tin định danh cho model ${editingCatalog.modelCode}`
                  : 'Định nghĩa mẫu thiết bị trong danh mục phần cứng'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleAttemptClose}
              aria-label="Đóng hộp thoại"
              className="rounded-full p-2 text-muted hover:bg-sidebar hover:text-text transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Form Content */}
          <form id="catalog-form" onSubmit={handleSubmit} className="custom-scrollbar overflow-y-auto px-5 py-4 space-y-4 flex-1">
            {/* Tên dòng sản phẩm */}
            <div>
              <label htmlFor="catalog-name" className="block text-xs font-medium text-text mb-1">
                Tên dòng sản phẩm <span className="text-rose-500">*</span>
              </label>
              <input
                id="catalog-name"
                data-testid="catalog-name-input"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ví dụ: Đèn LED RGB HESTA Aura"
                className="w-full min-h-[44px] rounded-xl border border-line bg-sidebar/30 px-3.5 py-2.5 text-xs sm:text-sm text-text placeholder:text-muted/60 focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* Loại thiết bị (Custom Dropdown) */}
            <div>
              <label className="block text-xs font-medium text-text mb-1">
                Loại thiết bị <span className="text-rose-500">*</span>
              </label>
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  data-testid="device-type-select-btn"
                  onClick={() => setDeviceTypeDropdownOpen((prev) => !prev)}
                  aria-expanded={deviceTypeDropdownOpen}
                  aria-label="Chọn loại thiết bị"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-line bg-sidebar/30 hover:bg-sidebar/50 text-xs sm:text-sm text-text flex items-center justify-between gap-2 cursor-pointer focus:border-primary focus:outline-none transition-colors"
                >
                  <span className="truncate">{currentTypeDisplay}</span>
                  <ChevronDown className={`w-4 h-4 text-muted shrink-0 transition-transform ${deviceTypeDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {deviceTypeDropdownOpen && (
                  <div
                    role="listbox"
                    className="custom-scrollbar absolute left-0 right-0 top-full mt-1.5 z-40 max-h-52 overflow-y-auto rounded-2xl border border-line bg-surface p-1 shadow-float animate-in fade-in zoom-in-95 duration-150"
                  >
                    {CATALOG_DEVICE_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        role="option"
                        aria-selected={formData.deviceType === t.value}
                        onClick={() => handleDeviceTypeChange(t.value)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                          formData.deviceType === t.value
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-text hover:bg-surface-hover'
                        }`}
                      >
                        <span className="truncate">{t.label} ({t.value})</span>
                        {formData.deviceType === t.value && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Mã model & Tiền tố sê-ri side-by-side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="catalog-model" className="block text-xs font-medium text-text mb-1">
                  Mã model <span className="text-rose-500">*</span>
                </label>
                <input
                  id="catalog-model"
                  data-testid="catalog-model-input"
                  type="text"
                  required
                  value={formData.modelCode}
                  onChange={(e) => setFormData({ ...formData, modelCode: e.target.value.toUpperCase() })}
                  placeholder="HESTA-RGB-01"
                  className="w-full min-h-[44px] rounded-xl border border-line bg-sidebar/30 px-3.5 py-2.5 text-xs sm:text-sm font-mono text-text placeholder:text-muted/60 focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <span className="text-[11px] text-muted block mt-1">Mã định danh duy nhất</span>
              </div>

              <div>
                <label htmlFor="catalog-prefix" className="block text-xs font-medium text-text mb-1">
                  Tiền tố sê-ri <span className="text-rose-500">*</span>
                </label>
                <input
                  id="catalog-prefix"
                  data-testid="catalog-prefix-input"
                  type="text"
                  required
                  value={formData.serialPrefix}
                  onChange={(e) => setFormData({ ...formData, serialPrefix: e.target.value })}
                  placeholder="HESTA-RGB-"
                  className="w-full min-h-[44px] rounded-xl border border-line bg-sidebar/30 px-3.5 py-2.5 text-xs sm:text-sm font-mono text-text placeholder:text-muted/60 focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <span className="text-[11px] text-muted block mt-1">Đuôi số sê-ri tự tăng</span>
              </div>
            </div>

            {/* Live example caption */}
            <p className="text-[11px] font-mono text-muted">
              Mẫu số sê-ri sinh ra: <span className="font-semibold text-text">{exampleSerial}</span>
            </p>

            {/* Clean Image Upload Dropzone */}
            <div>
              <label className="block text-xs font-medium text-text mb-1">
                Hình ảnh sản phẩm
              </label>

              {formData.imageUrl ? (
                <div className="relative rounded-2xl border border-line bg-sidebar/40 p-2.5 overflow-hidden">
                  <div className="relative h-36 w-full flex items-center justify-center overflow-hidden rounded-xl bg-surface">
                    <img
                      src={formData.imageUrl}
                      alt="Xem trước ảnh sản phẩm"
                      className="max-h-full max-w-full object-contain"
                    />
                    {uploadingImage && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-1.5 text-white">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        <span className="text-xs font-medium">Đang xử lý ảnh...</span>
                      </div>
                    )}
                  </div>

                  {!uploadingImage && (
                    <div className="mt-2.5 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleReCrop}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-line bg-surface hover:bg-surface-hover text-xs font-medium text-text shadow-2xs transition-colors cursor-pointer"
                        title="Cắt xén hoặc căn chỉnh lại vị trí ảnh"
                      >
                        <Crop className="w-3.5 h-3.5 text-primary" />
                        <span>Cắt xén</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-line bg-surface hover:bg-surface-hover text-xs font-medium text-text shadow-2xs transition-colors cursor-pointer"
                        title="Chọn ảnh khác từ máy tính"
                      >
                        <UploadCloud className="w-3.5 h-3.5 text-muted" />
                        <span>Đổi ảnh</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, imageUrl: '' }))}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 text-xs font-medium hover:bg-rose-100 transition-colors cursor-pointer"
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
                  data-testid="catalog-image-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingFile(true);
                  }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={handleDrop}
                  className={`rounded-2xl border-2 border-dashed p-5 transition-all text-center cursor-pointer ${
                    isDraggingFile
                      ? 'border-primary bg-primary/5'
                      : 'border-line hover:border-primary/60 bg-sidebar/20 hover:bg-sidebar/40'
                  }`}
                >
                  <div className="w-10 h-10 mx-auto rounded-xl bg-sidebar flex items-center justify-center text-muted mb-2">
                    {uploadingImage ? (
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    ) : (
                      <UploadCloud className="w-5 h-5 text-muted" />
                    )}
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-text">
                    {uploadingImage ? 'Đang tải ảnh lên...' : 'Kéo thả hoặc nhấp để tải ảnh lên'}
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Hỗ trợ PNG, JPG, WebP tối đa 5MB · Hỗ trợ cắt xén ảnh
                  </p>
                </div>
              )}
            </div>

            {/* Mô tả sản phẩm (3 rows) */}
            <div>
              <label htmlFor="catalog-desc" className="block text-xs font-medium text-text mb-1">
                Mô tả sản phẩm
              </label>
              <textarea
                id="catalog-desc"
                data-testid="catalog-desc-input"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ghi chú chi tiết về thông số kỹ thuật, bảo hành, ghi chú đóng gói..."
                className="w-full rounded-xl border border-line bg-sidebar/30 px-3.5 py-2 text-xs sm:text-sm text-text placeholder:text-muted/60 focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              />
            </div>
          </form>

          {/* Sticky Footer */}
          <div className="sticky bottom-0 z-10 px-5 py-3.5 border-t border-line bg-surface/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
            <div className="min-w-0 flex-1">
              {validationHint && (
                <span data-testid="validation-hint" className="text-[11px] text-muted truncate block">
                  {validationHint}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleAttemptClose}
                className="px-4 py-2 rounded-xl border border-line bg-surface hover:bg-surface-hover text-xs font-semibold text-muted hover:text-text transition-colors cursor-pointer"
              >
                Hủy
              </button>

              <button
                type="submit"
                form="catalog-form"
                data-testid="catalog-submit-btn"
                disabled={!isValid || loading || uploadingImage}
                title={validationHint || undefined}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-98"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
                <span>{editingCatalog ? 'Lưu thay đổi' : 'Tạo dòng sản phẩm'}</span>
              </button>
            </div>
          </div>
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

      {/* Unsaved Changes Confirmation Modal */}
      <ConfirmModal
        isOpen={showDiscardConfirm}
        title="Thay đổi chưa lưu"
        description="Bạn có các thay đổi chưa được lưu vào dòng sản phẩm. Bạn có chắc chắn muốn thoát mà không lưu không?"
        confirmText="Thoát không lưu"
        cancelText="Tiếp tục chỉnh sửa"
        variant="primary"
        onConfirm={() => {
          setShowDiscardConfirm(false);
          onClose();
        }}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </>
  );
};
