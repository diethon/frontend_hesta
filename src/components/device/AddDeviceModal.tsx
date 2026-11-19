import React, { useState, useEffect, useId, useRef, useCallback } from 'react';
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
  Camera,
  Keyboard,
  RotateCw,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
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
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [qrTokenInput, setQrTokenInput] = useState<string>('');
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [resolvedDevice, setResolvedDevice] = useState<DevicePublicPreviewResponse | null>(null);
  const [customName, setCustomName] = useState<string>('');
  const [claimRoomId, setClaimRoomId] = useState<string>('');
  const [isClaiming, setIsClaiming] = useState<boolean>(false);

  // Camera states
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isCameraStarting, setIsCameraStarting] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const tokenInputId = useId();
  const customNameInputId = useId();
  const claimRoomSelectId = useId();

  const stopCameraScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping QR scanner:', err);
      } finally {
        scannerRef.current = null;
        setIsCameraActive(false);
        setIsCameraStarting(false);
      }
    }
  }, []);

  // Handler for resolving token / QR code
  const resolveToken = useCallback(
    async (rawToken: string) => {
      const token = rawToken.trim();
      if (!token) {
        notify.warning('Vui lòng nhập mã Token hoặc quét mã QR');
        return;
      }

      try {
        setIsResolving(true);
        const preview = await resolveQrToken(token);
        setResolvedDevice(preview);
        setCustomName(preview.name || '');
        notify.success(`Đã nhận diện thiết bị: ${preview.name}`);
        await stopCameraScanner();
      } catch (err) {
        setResolvedDevice(null);
        notify.error(getErrorMessage(err, 'Mã QR / Token không hợp lệ hoặc thiết bị đã được kích hoạt'));
      } finally {
        setIsResolving(false);
      }
    },
    [stopCameraScanner]
  );

  // Start Camera Scanner
  const startCameraScanner = useCallback(async () => {
    await stopCameraScanner();
    setCameraError(null);
    setIsCameraStarting(true);

    // Wait for DOM element
    await new Promise((r) => setTimeout(r, 120));
    const container = document.getElementById('hesta-qr-reader');
    if (!container) {
      setIsCameraStarting(false);
      return;
    }

    try {
      const scanner = new Html5Qrcode('hesta-qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.333333,
        },
        async (decodedText: string) => {
          if (decodedText && decodedText.trim()) {
            setQrTokenInput(decodedText.trim());
            await resolveToken(decodedText.trim());
          }
        },
        () => {
          // ignore scan frame misses
        }
      );

      setIsCameraActive(true);
      setIsCameraStarting(false);
    } catch (err: unknown) {
      console.warn('Failed to start camera:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError(
          'Trình duyệt chưa được cấp quyền truy cập Camera. Vui lòng cho phép quyền Camera hoặc dùng tab Nhập mã thủ công.'
        );
      } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
        setCameraError(
          'Không tìm thấy thiết bị Camera / Webcam trên máy tính này. Vui lòng dùng tab Nhập mã thủ công.'
        );
      } else {
        setCameraError('Không thể khởi động Camera. Bạn có thể chuyển sang tab Nhập mã thủ công.');
      }
      setIsCameraActive(false);
      setIsCameraStarting(false);
    }
  }, [stopCameraScanner, resolveToken]);

  // Camera lifecycle based on modal open and active tab (deferred to next tick to avoid React 19 setState warning)
  useEffect(() => {
    let cancelled = false;
    if (isOpen && activeTab === 'camera' && !resolvedDevice) {
      const timer = setTimeout(() => {
        if (!cancelled) {
          void startCameraScanner();
        }
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(timer);
        void stopCameraScanner();
      };
    } else {
      void stopCameraScanner();
    }
  }, [isOpen, activeTab, resolvedDevice, startCameraScanner, stopCameraScanner]);

  // Reset state when modal opens (deferred to next tick to avoid cascading renders warning in React 19)
  useEffect(() => {
    if (isOpen) {
      const initialRoom =
        selectedRoomId && selectedRoomId !== 'ALL'
          ? selectedRoomId
          : rooms[0]?.id || '';
      const timer = setTimeout(() => {
        setClaimRoomId(initialRoom);
        setQrTokenInput('');
        setResolvedDevice(null);
        setCustomName('');
        setIsResolving(false);
        setIsClaiming(false);
        setCameraError(null);
        setActiveTab('camera');
      }, 0);
      return () => clearTimeout(timer);
    } else {
      void stopCameraScanner();
    }
  }, [isOpen, selectedRoomId, rooms, stopCameraScanner]);

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

  const handleResolveManual = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    resolveToken(qrTokenInput);
  };

  // Handler for claiming resolved device
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

  const handleResetScan = () => {
    setResolvedDevice(null);
    setQrTokenInput('');
    setActiveTab('camera');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-device-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0f172a]/55 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl bg-[var(--solid)] border border-[var(--border)] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4.5 bg-[var(--g1)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/20 flex items-center justify-center shadow-xs">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 id="add-device-modal-title" className="text-lg font-bold text-[var(--text)]">
                Ghép Nối Thiết Bị Mới
              </h2>
              <p className="text-xs text-[var(--secondary)] mt-0.5">
                Quét mã QR từ camera hoặc nhập mã Onboarding Token
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--secondary)] hover:bg-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!resolvedDevice ? (
            <div className="space-y-4">
              {/* Tab Selector: Camera vs Manual */}
              <div className="flex p-1 rounded-2xl bg-[var(--g1)] border border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setActiveTab('camera')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'camera'
                      ? 'bg-[var(--accent)] text-white shadow-xs'
                      : 'text-[var(--secondary)] hover:text-[var(--text)]'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>Quét Camera QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('manual')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'manual'
                      ? 'bg-[var(--accent)] text-white shadow-xs'
                      : 'text-[var(--secondary)] hover:text-[var(--text)]'
                  }`}
                >
                  <Keyboard className="w-4 h-4" />
                  <span>Nhập mã thủ công</span>
                </button>
              </div>

              {/* TAB 1: CAMERA SCANNER */}
              {activeTab === 'camera' && (
                <div className="space-y-3">
                  <div className="relative w-full rounded-2xl overflow-hidden bg-black/90 border border-[var(--accent)]/30 min-h-[260px] flex flex-col items-center justify-center">
                    {/* Viewport for html5-qrcode */}
                    <div id="hesta-qr-reader" className="w-full h-full min-h-[260px]" />

                    {/* Loading Overlay */}
                    {isCameraStarting && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-2 z-10">
                        <RotateCw className="w-7 h-7 text-[var(--accent)] animate-spin" />
                        <span className="text-xs font-medium">Đang khởi động Camera...</span>
                      </div>
                    )}

                    {/* Camera Error Display */}
                    {cameraError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-black/90 text-center z-10">
                        <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
                        <p className="text-xs text-rose-300 max-w-xs mb-4 leading-relaxed">
                          {cameraError}
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={startCameraScanner}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--solid)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--muted)] transition-colors cursor-pointer"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>Thử lại</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('manual')}
                            className="px-3.5 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-bold hover:opacity-95 transition-colors cursor-pointer"
                          >
                            Nhập mã thủ công
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Reticle targeting overlay if camera active */}
                    {isCameraActive && !cameraError && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="relative w-52 h-52 border-2 border-[var(--accent)]/60 rounded-2xl shadow-inner">
                          {/* 4 Corner Markers */}
                          <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-[var(--accent)] rounded-tl-sm" />
                          <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-[var(--accent)] rounded-tr-sm" />
                          <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-[var(--accent)] rounded-bl-sm" />
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-[var(--accent)] rounded-br-sm" />
                          {/* Animated Scan Beam */}
                          <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse mt-24" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Camera tips */}
                  <div className="flex items-center justify-between text-xs text-[var(--secondary)] px-1">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Hướng camera vào mã QR in trên vỏ thiết bị hoặc tem dán.
                    </span>
                    <button
                      type="button"
                      onClick={startCameraScanner}
                      className="text-[var(--accent)] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      title="Làm mới camera"
                    >
                      <RotateCw className="w-3 h-3" />
                      Làm mới
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: MANUAL TOKEN INPUT */}
              {activeTab === 'manual' && (
                <form onSubmit={handleResolveManual} className="space-y-4">
                  <div>
                    <label
                      htmlFor={tokenInputId}
                      className="block text-xs font-bold uppercase tracking-wider text-[var(--secondary)] mb-1.5"
                    >
                      Chuỗi mã Onboarding / QR text
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          id={tokenInputId}
                          type="text"
                          value={qrTokenInput}
                          onChange={(e) => setQrTokenInput(e.target.value)}
                          placeholder="Nhập mã Token hoặc dán link syna://device/register?token=..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--g1)] text-sm text-[var(--text)] placeholder:text-[var(--tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] shadow-xs transition"
                          autoFocus
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isResolving || !qrTokenInput.trim()}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:opacity-95 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                      >
                        {isResolving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                        <span>Xác thực mã</span>
                      </button>
                    </div>
                  </div>

                  {/* Gợi ý định dạng rõ ràng */}
                  <div className="p-3.5 rounded-2xl bg-[var(--g1)] border border-[var(--border)] space-y-2 text-xs">
                    <span className="font-bold text-[var(--text)] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                      Định dạng mã hợp lệ:
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-[var(--secondary)] text-[11px] leading-relaxed">
                      <li>
                        Chuỗi QR tiêu chuẩn:{' '}
                        <code className="px-1.5 py-0.5 rounded bg-[var(--solid)] text-[var(--accent)] font-mono border border-[var(--border)]">
                          syna://device/register?token=DEV_XXX
                        </code>
                      </li>
                      <li>
                        Mã Token xuất xưởng in trên tem thiết bị:{' '}
                        <code className="px-1.5 py-0.5 rounded bg-[var(--solid)] text-[var(--accent)] font-mono border border-[var(--border)]">
                          HESTA-IOT-9921
                        </code>
                      </li>
                    </ul>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* Resolved Device Preview & Claim configuration */
            <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-5 sm:p-6 space-y-5 gentle-rise">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-bold">Xác thực thiết bị thành công!</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Sẵn sàng ghép nối
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleResetScan}
                  className="text-xs text-[var(--secondary)] hover:text-[var(--accent)] font-semibold underline cursor-pointer"
                >
                  Quét thiết bị khác
                </button>
              </div>

              {/* Thông tin thiết bị xác thực (bố cục 2 cột sắc nét) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[var(--solid)] p-4 rounded-2xl border border-[var(--border)] text-xs shadow-xs">
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-[var(--g1)]">
                  <Cpu className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[var(--tertiary)] block text-[11px]">Tên xuất xưởng:</span>
                    <span className="font-bold text-[var(--text)] truncate block">{resolvedDevice.name}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-[var(--g1)]">
                  <Tag className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[var(--tertiary)] block text-[11px]">Loại thiết bị:</span>
                    <span className="font-semibold text-[var(--text)] truncate block">{resolvedDevice.deviceType}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-[var(--g1)]">
                  <Hash className="w-4 h-4 text-[var(--secondary)] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[var(--tertiary)] block text-[11px]">Model:</span>
                    <span className="font-mono text-[var(--text)] truncate block">
                      {resolvedDevice.model || 'Chưa định danh'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-[var(--g1)]">
                  <Hash className="w-4 h-4 text-[var(--secondary)] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[var(--tertiary)] block text-[11px]">Serial Number:</span>
                    <span className="font-mono text-[var(--text)] truncate block">
                      {resolvedDevice.serialNumber || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cấu hình trước khi Claim */}
              <div className="space-y-4 pt-2 border-t border-[var(--border)]/60">
                <div className="space-y-1.5">
                  <label
                    htmlFor={customNameInputId}
                    className="block text-xs font-bold text-[var(--text)]"
                  >
                    Tên gọi hiển thị trong nhà
                  </label>
                  <input
                    id={customNameInputId}
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder={resolvedDevice.name}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--solid)] text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] shadow-xs transition"
                  />
                  <p className="text-[11px] text-[var(--secondary)]">
                    Đặt tên dễ nhận biết (VD: Điều hòa phòng khách, Đèn bàn làm việc...)
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor={claimRoomSelectId}
                    className="block text-xs font-bold text-[var(--text)] flex items-center gap-1.5"
                  >
                    <MapPin className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>Chọn phòng lắp đặt</span>
                  </label>
                  {rooms.length === 0 ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-600/15 p-2.5 rounded-xl border border-amber-600/30">
                      Chưa có phòng nào trong ngôi nhà này. Vui lòng tạo phòng trước khi ghép nối!
                    </p>
                  ) : (
                    <select
                      id={claimRoomSelectId}
                      value={claimRoomId}
                      onChange={(e) => setClaimRoomId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--solid)] text-sm font-semibold text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] shadow-xs transition cursor-pointer"
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
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-[var(--accent)] hover:opacity-95 text-white text-sm font-bold shadow-md hover:shadow-lg transition active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
