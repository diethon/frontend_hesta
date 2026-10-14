import React, { useState, useEffect, useId } from 'react';
import {
  X,
  QrCode,
  Loader2,
  CheckCircle2,
  Search,
  Check,
  Cpu,
  MapPin,
  Tag,
  Hash,
} from 'lucide-react';
import {
  resolveQrToken,
  claimDevice,
  type DevicePublicPreviewResponse,
} from '../../services/deviceApi';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';

export interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  homeId: string;
  rooms: { id: string; name: string }[];
  selectedRoomId?: string;
  onSuccess?: () => void;
}

export const AddDeviceModal: React.FC<AddDeviceModalProps> = ({
  isOpen,
  onClose,
  homeId,
  rooms,
  selectedRoomId,
  onSuccess,
}) => {
  const [qrTokenInput, setQrTokenInput] = useState<string>('');
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [resolvedDevice, setResolvedDevice] = useState<DevicePublicPreviewResponse | null>(null);
  const [customName, setCustomName] = useState<string>('');
  const [claimRoomId, setClaimRoomId] = useState<string>('');
  const [isClaiming, setIsClaiming] = useState<boolean>(false);

  const tokenInputId = useId();
  const customNameInputId = useId();
  const claimRoomSelectId = useId();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialRoom =
        selectedRoomId && selectedRoomId !== 'ALL'
          ? selectedRoomId
          : rooms[0]?.id || '';
      setClaimRoomId(initialRoom);
      setQrTokenInput('');
      setResolvedDevice(null);
      setCustomName('');
      setIsResolving(false);
      setIsClaiming(false);
    }
  }, [isOpen, selectedRoomId, rooms]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Step 2: Handler for resolving token / QR code
  const handleResolveToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const token = qrTokenInput.trim();
    if (!token) {
      notify.warning('Vui lòng nhập mã Token hoặc chuỗi QR');
      return;
    }

    try {
      setIsResolving(true);
      const preview = await resolveQrToken(token);
      setResolvedDevice(preview);
      setCustomName(preview.name || '');
      notify.success(`Đã tìm thấy thiết bị: ${preview.name}`);
    } catch (err) {
      setResolvedDevice(null);
      notify.error(getErrorMessage(err, 'Mã Token không hợp lệ hoặc đã hết hạn'));
    } finally {
      setIsResolving(false);
    }
  };

  // Step 5 & 6: Handler for claiming resolved device
  const handleClaimDevice = async () => {
    if (!resolvedDevice) return;
    if (!claimRoomId) {
      notify.error('Vui lòng chọn phòng để lắp đặt thiết bị!');
      return;
    }

    const rawToken = qrTokenInput.trim().replace('syna://device/register?token=', '');

    try {
      setIsClaiming(true);
      await claimDevice(resolvedDevice.deviceId, {
        token: rawToken,
        homeId,
        roomId: claimRoomId,
        name: customName.trim() || resolvedDevice.name,
      });

      notify.success(`Ghép nối thành công thiết bị ${customName || resolvedDevice.name}!`);
      onSuccess?.();
      onClose();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không thể ghép nối thiết bị vào nhà'));
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-device-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl bg-surface border border-line shadow-2xl overflow-hidden gentle-rise"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4.5 bg-sidebar/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 id="add-device-modal-title" className="text-lg font-bold text-text">
                Ghép Nối Thiết Bị Mới
              </h2>
              <p className="text-xs text-muted">
                Xác thực mã Token Onboarding hoặc mã QR từ thiết bị IoT
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-icon hover:bg-sidebar-hover hover:text-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Step 1 & 2: Token / QR input */}
          <form onSubmit={handleResolveToken} className="space-y-3">
            <label
              htmlFor={tokenInputId}
              className="block text-xs font-bold uppercase tracking-wider text-muted"
            >
              Chuỗi mã Onboarding / QR text
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id={tokenInputId}
                  type="text"
                  value={qrTokenInput}
                  onChange={(e) => {
                    setQrTokenInput(e.target.value);
                    if (resolvedDevice) setResolvedDevice(null);
                  }}
                  placeholder="Nhập Onboarding Token hoặc syna://device/register?token=..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface text-sm text-text placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary shadow-xs transition"
                />
              </div>
              <button
                type="submit"
                disabled={isResolving || !qrTokenInput.trim()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {isResolving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>Xác thực mã</span>
              </button>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              Nhập mã định danh Token do nhà sản xuất cung cấp hoặc quét qua camera thiết bị di động (hỗ trợ prefix <span className="font-mono text-primary">syna://device/register?token=</span>).
            </p>
          </form>

          {/* Step 3, 4, 5: Resolved Device Preview & Claim configuration */}
          {resolvedDevice && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-5 gentle-rise">
              <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="text-sm font-bold">Xác thực thiết bị thành công!</span>
              </div>

              {/* Thông tin thiết bị xác thực */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface p-4 rounded-xl border border-line text-xs shadow-xs">
                <div className="flex items-start gap-2.5">
                  <Cpu className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="text-muted block text-[11px]">Tên xuất xưởng:</span>
                    <span className="font-bold text-text truncate block">{resolvedDevice.name}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Tag className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="text-muted block text-[11px]">Loại thiết bị:</span>
                    <span className="font-semibold text-text truncate block">{resolvedDevice.deviceType}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Hash className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="text-muted block text-[11px]">Model:</span>
                    <span className="font-mono text-text truncate block">
                      {resolvedDevice.model || 'Chưa định danh'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Hash className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="text-muted block text-[11px]">Serial Number:</span>
                    <span className="font-mono text-text truncate block">
                      {resolvedDevice.serialNumber || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cấu hình trước khi Claim */}
              <div className="space-y-4 pt-1 border-t border-line/60">
                <div className="space-y-1.5">
                  <label
                    htmlFor={customNameInputId}
                    className="block text-xs font-bold text-text"
                  >
                    Tên gọi hiển thị trong nhà
                  </label>
                  <input
                    id={customNameInputId}
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder={resolvedDevice.name}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary shadow-xs transition"
                  />
                  <p className="text-[11px] text-muted">
                    Đặt tên dễ nhận biết (VD: Điều hòa phòng khách, Đèn bàn làm việc...)
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor={claimRoomSelectId}
                    className="block text-xs font-bold text-text flex items-center gap-1.5"
                  >
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    <span>Chọn phòng lắp đặt</span>
                  </label>
                  {rooms.length === 0 ? (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                      Chưa có phòng nào trong ngôi nhà này. Vui lòng tạo phòng trước khi ghép nối!
                    </p>
                  ) : (
                    <select
                      id={claimRoomSelectId}
                      value={claimRoomId}
                      onChange={(e) => setClaimRoomId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface text-sm font-semibold text-text focus:outline-none focus:ring-2 focus:ring-primary shadow-xs transition"
                    >
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isClaiming || !claimRoomId || rooms.length === 0}
                  onClick={handleClaimDevice}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-md hover:shadow-lg transition active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isClaiming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang ghép nối vào ngôi nhà...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Hoàn tất ghép nối</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
