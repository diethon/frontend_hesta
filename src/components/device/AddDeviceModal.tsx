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

  // Handle ESC key & body scroll lock while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
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
        className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl bg-white border border-[#cbd5e1] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-4 bg-[#f8fafc]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#eff6ff] text-[#1d4ed8] border border-[#3b82f6]/40 flex items-center justify-center shadow-2xs">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 id="add-device-modal-title" className="text-lg font-bold text-[#0f172a]">
                Ghép Nối Thiết Bị Mới
              </h2>
              <p className="text-xs text-[#475569] mt-0.5">
                Quét mã QR từ camera hoặc nhập mã Onboarding Token
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#cbd5e1] bg-white text-[#475569] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!resolvedDevice ? (
            <div className="space-y-4">
              {/* Tab Selector: Camera vs Manual */}
              <div className="flex p-1 rounded-2xl bg-[#f1f5f9] border border-[#cbd5e1]">
                <button
                  type="button"
                  onClick={() => setActiveTab('camera')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'camera'
                      ? 'bg-[#2563eb] text-white shadow-xs'
                      : 'text-[#334155] hover:text-[#0f172a] hover:bg-white/75'
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
                      ? 'bg-[#2563eb] text-white shadow-xs'
                      : 'text-[#334155] hover:text-[#0f172a] hover:bg-white/75'
                  }`}
                >
                  <Keyboard className="w-4 h-4" />
                  <span>Nhập mã thủ công</span>
                </button>
              </div>

              {/* TAB 1: CAMERA SCANNER */}
              {activeTab === 'camera' && (
                <div className="space-y-3">
                  <div
                    className={`relative w-full rounded-2xl overflow-hidden min-h-[260px] flex flex-col items-center justify-center ${
                      cameraError
                        ? 'bg-[#f8fafc] border border-[#cbd5e1]'
                        : 'bg-[#0f172a] border border-[#334155]'
                    }`}
                  >
                    {/* Viewport for html5-qrcode */}
                    <div id="hesta-qr-reader" className="w-full h-full min-h-[260px]" />

                    {/* Loading Overlay */}
                    {isCameraStarting && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f172a]/90 text-white gap-2 z-10">
                        <RotateCw className="w-7 h-7 text-[#38bdf8] animate-spin" />
                        <span className="text-xs font-medium">Đang khởi động Camera...</span>
                      </div>
                    )}

                    {/* Camera Error Display */}
                    {cameraError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-[#f8fafc] text-center z-10">
                        <span className="w-12 h-12 rounded-2xl bg-[#fff1f2] border border-[#f43f5e]/40 text-[#be123c] flex items-center justify-center mb-3 shadow-2xs">
                          <AlertCircle className="w-6 h-6" />
                        </span>
                        <h3 className="text-sm font-bold text-[#0f172a] mb-1">
                          Không thể khởi động Camera
                        </h3>
                        <p className="text-xs text-[#475569] max-w-sm mb-4 leading-relaxed">
                          {cameraError}
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={startCameraScanner}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#cbd5e1] text-xs font-semibold text-[#0f172a] hover:bg-[#f1f5f9] transition-colors cursor-pointer"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>Thử lại</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('manual')}
                            className="px-4 py-2 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
                          >
                            Nhập mã thủ công
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Reticle targeting overlay if camera active */}
                    {isCameraActive && !cameraError && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="relative w-52 h-52 border-2 border-[#38bdf8]/60 rounded-2xl shadow-inner">
                          {/* 4 Corner Markers */}
                          <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-[#38bdf8] rounded-tl-sm" />
                          <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-[#38bdf8] rounded-tr-sm" />
                          <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-[#38bdf8] rounded-bl-sm" />
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-[#38bdf8] rounded-br-sm" />
                          {/* Animated Scan Beam */}
                          <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse mt-24" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Camera tips */}
                  <div className="flex items-center justify-between text-xs text-[#475569] px-1">
                    <span className="flex items-center gap-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                          isCameraActive
                            ? 'bg-[#10b981] animate-pulse'
                            : isCameraStarting
                              ? 'bg-[#f59e0b] animate-pulse'
                              : 'bg-[#94a3b8]'
                        }`}
                      />
                      Hướng camera vào mã QR in trên vỏ thiết bị hoặc tem dán.
                    </span>
                    <button
                      type="button"
                      onClick={startCameraScanner}
                      className="text-[#2563eb] hover:underline font-bold flex items-center gap-1 cursor-pointer shrink-0"
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
                      className="block text-xs font-bold uppercase tracking-wider text-[#334155] mb-1.5"
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
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#cbd5e1] hover:border-[#94a3b8] bg-white text-sm text-[#0f172a] placeholder:text-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 focus:border-[#2563eb] transition"
                          autoFocus
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isResolving || !qrTokenInput.trim()}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
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
                  <div className="p-4 rounded-2xl bg-[#f8fafc] border border-[#cbd5e1] space-y-2.5 text-xs">
                    <span className="font-bold text-[#0f172a] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#2563eb]" />
                      Định dạng mã hợp lệ:
                    </span>
                    <ul className="list-disc list-inside space-y-1.5 text-[#475569] text-[11px] leading-relaxed">
                      <li>
                        Chuỗi QR tiêu chuẩn:{' '}
                        <code className="px-2 py-0.5 rounded-lg bg-[#eff6ff] text-[#1d4ed8] font-mono font-semibold border border-[#3b82f6]/35">
                          syna://device/register?token=DEV_XXX
                        </code>
                      </li>
                      <li>
                        Mã Token xuất xưởng in trên tem thiết bị:{' '}
                        <code className="px-2 py-0.5 rounded-lg bg-[#eff6ff] text-[#1d4ed8] font-mono font-semibold border border-[#3b82f6]/35">
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
            <div className="rounded-2xl border border-[#10b981]/45 bg-[#ecfdf5]/50 p-5 space-y-5 gentle-rise">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[#047857] flex-wrap">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-bold">Xác thực thiết bị thành công!</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ecfdf5] text-[#047857] border border-[#10b981]/45">
                    Sẵn sàng ghép nối
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleResetScan}
                  className="text-xs text-[#2563eb] hover:underline font-bold cursor-pointer shrink-0"
                >
                  Quét thiết bị khác
                </button>
              </div>

              {/* Thông tin thiết bị xác thực (bố cục 2 cột sắc nét) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 rounded-2xl border border-[#cbd5e1] text-xs shadow-2xs">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                  <Cpu className="w-4 h-4 text-[#2563eb] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[#64748b] block text-[11px]">Tên xuất xưởng:</span>
                    <span className="font-bold text-[#0f172a] truncate block">{resolvedDevice.name}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                  <Tag className="w-4 h-4 text-[#2563eb] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[#64748b] block text-[11px]">Loại thiết bị:</span>
                    <span className="font-semibold text-[#0f172a] truncate block">{resolvedDevice.deviceType}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                  <Hash className="w-4 h-4 text-[#64748b] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[#64748b] block text-[11px]">Model:</span>
                    <span className="font-mono text-[#0f172a] truncate block">
                      {resolvedDevice.model || 'Chưa định danh'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                  <Hash className="w-4 h-4 text-[#64748b] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[#64748b] block text-[11px]">Serial Number:</span>
                    <span className="font-mono text-[#0f172a] truncate block">
                      {resolvedDevice.serialNumber || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cấu hình trước khi Claim */}
              <div className="space-y-4 pt-3 border-t border-[#e2e8f0]">
                <div className="space-y-1.5">
                  <label
                    htmlFor={customNameInputId}
                    className="block text-xs font-bold text-[#0f172a]"
                  >
                    Tên gọi hiển thị trong nhà
                  </label>
                  <input
                    id={customNameInputId}
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder={resolvedDevice.name}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#cbd5e1] hover:border-[#94a3b8] bg-white text-sm text-[#0f172a] placeholder:text-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 focus:border-[#2563eb] transition"
                  />
                  <p className="text-[11px] text-[#475569]">
                    Đặt tên dễ nhận biết (VD: Điều hòa phòng khách, Đèn bàn làm việc...)
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor={claimRoomSelectId}
                    className="block text-xs font-bold text-[#0f172a] flex items-center gap-1.5"
                  >
                    <MapPin className="w-3.5 h-3.5 text-[#2563eb]" />
                    <span>Chọn phòng lắp đặt</span>
                  </label>
                  {rooms.length === 0 ? (
                    <p className="text-xs text-[#92400e] bg-[#fffbeb] p-3 rounded-xl border border-[#f59e0b]/45 font-medium">
                      Chưa có phòng nào trong ngôi nhà này. Vui lòng tạo phòng trước khi ghép nối!
                    </p>
                  ) : (
                    <select
                      id={claimRoomSelectId}
                      value={claimRoomId}
                      onChange={(e) => setClaimRoomId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#cbd5e1] hover:border-[#94a3b8] bg-white text-sm font-semibold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 focus:border-[#2563eb] transition cursor-pointer"
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
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-bold shadow-sm hover:shadow-md transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
