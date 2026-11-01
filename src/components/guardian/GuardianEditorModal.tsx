import React, { useState, useEffect } from 'react';
import { Icon } from '../home/HomeIcons';
import type { ParentalGuardianRule, CreateGuardianRuleInput } from '../../types/guardian';
import { getDevices } from '../../services/sceneApi';
import type { DeviceSummary } from '../../types/automation';
import toast from 'react-hot-toast';

interface GuardianEditorModalProps {
  homeId: string;
  initialRule?: ParentalGuardianRule | null;
  onClose: () => void;
  onSave: (input: CreateGuardianRuleInput) => Promise<void>;
}

export const GuardianEditorModal: React.FC<GuardianEditorModalProps> = ({
  homeId,
  initialRule,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState<string>(
    initialRule?.name || 'Giới hạn xem TV khi vắng nhà'
  );
  const [targetDeviceId, setTargetDeviceId] = useState<string>(
    initialRule?.targetDeviceId || ''
  );
  const [cameraDeviceId, setCameraDeviceId] = useState<string>(
    initialRule?.cameraDeviceId || ''
  );
  const [allowedDuration, setAllowedDuration] = useState<number>(
    initialRule?.allowedDurationMinutes || 45
  );
  const [warningMinutes, setWarningMinutes] = useState<number>(
    initialRule?.warningMinutesBefore || 5
  );
  const [autoLockout, setAutoLockout] = useState<boolean>(
    initialRule ? initialRule.autoLockout : true
  );

  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    loadDevices();
  }, [homeId]);

  const loadDevices = async () => {
    try {
      const data = await getDevices(homeId);
      setDevices(data);
      if (!targetDeviceId && data.length > 0) {
        const tvOrPlug = data.find((d) => {
          const type = (d.deviceType || '').toUpperCase();
          const n = (d.name || '').toLowerCase();
          return type.includes('PLUG') || type.includes('SOCKET') || n.includes('tv') || n.includes('tivi');
        });
        setTargetDeviceId(tvOrPlug ? tvOrPlug.id : data[0].id);
      }
    } catch {
      toast.error('Không thể tải danh sách thiết bị');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên quy tắc');
      return;
    }
    if (!targetDeviceId) {
      toast.error('Vui lòng chọn thiết bị cần giám sát');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        targetDeviceId,
        cameraDeviceId: cameraDeviceId || undefined,
        allowedDurationMinutes: allowedDuration,
        warningMinutesBefore: warningMinutes,
        autoLockout,
      });
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lưu quy tắc');
    } finally {
      setSubmitting(false);
    }
  };

  const durationPresets = [15, 30, 45, 60, 90, 120];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="glass-card glass-g2 w-full max-w-xl rounded-3xl border border-[var(--border)] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <header className="p-5 border-b border-[var(--border)] bg-[var(--solid)]/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
              <Icon name="shield" size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold text-[var(--text)]">
                {initialRule ? 'Cập nhật Quy tắc Giám hộ' : 'Tạo Quy tắc Giám hộ Con trẻ'}
              </h2>
              <span className="text-xs text-[var(--secondary)]">
                Tự động kiểm soát thời gian sử dụng thiết bị khi phụ huynh vắng nhà
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[var(--border)] flex items-center justify-center text-[var(--secondary)] cursor-pointer"
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        {/* ── Form Body ── */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {/* Rule Name */}
          <div>
            <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block mb-1">
              Tên quy tắc giám hộ
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Giới hạn TV phòng khách khi bố mẹ vắng nhà"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--solid)] text-[var(--text)] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 shadow-2xs"
              required
            />
          </div>

          {/* Target Device */}
          <div>
            <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block mb-1">
              Thiết bị cần giới hạn thời gian (TV, Máy tính, Ổ cắm)
            </label>
            <select
              value={targetDeviceId}
              onChange={(e) => setTargetDeviceId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--solid)] text-[var(--text)] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 shadow-2xs cursor-pointer"
              required
            >
              {devices.map((dev) => (
                <option key={dev.id} value={dev.id}>
                  {dev.name} ({dev.deviceType})
                </option>
              ))}
            </select>
            <span className="text-[11px] text-[var(--tertiary)] block mt-1">
              Khi con bật thiết bị này, đồng hồ đếm ngược sẽ tự động kích hoạt.
            </span>
          </div>

          {/* Camera Sensor (Optional) */}
          <div>
            <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block mb-1">
              Camera AI / Cảm biến nhận diện vắng nhà (Tùy chọn)
            </label>
            <select
              value={cameraDeviceId}
              onChange={(e) => setCameraDeviceId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--solid)] text-[var(--text)] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 shadow-2xs cursor-pointer"
            >
              <option value="">-- Không dùng (Kích hoạt thủ công qua nút Vắng nhà) --</option>
              {devices
                .filter(
                  (d) =>
                    d.deviceType === 'CAMERA_AI' ||
                    (d.name || '').toLowerCase().includes('cam') ||
                    (d.name || '').toLowerCase().includes('cảm biến')
                )
                .map((dev) => (
                  <option key={dev.id} value={dev.id}>
                    {dev.name} ({dev.deviceType})
                  </option>
                ))}
            </select>
            <span className="text-[11px] text-[var(--tertiary)] block mt-1">
              Tự động nhận diện khi người lớn bước ra ngoài cửa để kích hoạt chế độ giám sát.
            </span>
          </div>

          {/* Allowed Duration */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider">
                Thời lượng cho phép sử dụng mỗi phiên
              </label>
              <span className="text-xs font-bold text-[var(--accent)]">{allowedDuration} phút</span>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-6 gap-2 mb-2">
              {durationPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAllowedDuration(preset)}
                  className={`py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    allowedDuration === preset
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                      : 'bg-[var(--solid)]/80 text-[var(--secondary)] border border-[var(--border)] hover:bg-[var(--solid)]'
                  }`}
                >
                  {preset}p
                </button>
              ))}
            </div>

            <input
              type="range"
              min="1"
              max="180"
              value={allowedDuration}
              onChange={(e) => setAllowedDuration(Number(e.target.value))}
              className="w-full accent-[var(--accent)] cursor-pointer"
            />
          </div>

          {/* Warning Minutes */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider">
                Cảnh báo trước khi ngắt nguồn
              </label>
              <span className="text-xs font-bold text-amber-600">{warningMinutes} phút</span>
            </div>
            <input
              type="range"
              min="1"
              max="15"
              value={warningMinutes}
              onChange={(e) => setWarningMinutes(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <span className="text-[11px] text-[var(--tertiary)] block mt-1">
              Nhắc nhở bé lưu bài hoặc chuẩn bị kết thúc phim trước khi thiết bị tự tắt.
            </span>
          </div>

          {/* Auto Lockout checkbox */}
          <div className="p-3.5 rounded-2xl bg-[var(--solid)]/60 border border-[var(--border)] flex items-start gap-3">
            <input
              type="checkbox"
              id="autoLockout"
              checked={autoLockout}
              onChange={(e) => setAutoLockout(e.target.checked)}
              className="mt-0.5 rounded border-[var(--border)] accent-rose-600 cursor-pointer"
            />
            <label htmlFor="autoLockout" className="text-xs cursor-pointer select-none">
              <span className="font-bold flex items-center gap-1.5 text-rose-700">
                <Icon name="lock" size={13} /> Khóa cưỡng chế &amp; Chống lách luật (Khuyến nghị)
              </span>
              <p className="text-[11px] text-[var(--secondary)] mt-0.5 leading-relaxed">
                Sau khi hết giờ, nếu bé cố tình bấm nút bật lại trên ổ cắm hoặc điều khiển, hệ thống sẽ tự động phát hiện và ngắt nguồn ngay lập tức.
              </p>
            </label>
          </div>

          {/* Submit buttons */}
          <footer className="pt-3 border-t border-[var(--border)] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--solid)] border border-[var(--border)] text-[var(--secondary)] hover:text-[var(--text)] transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[var(--accent)] text-white hover:opacity-90 shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Icon name="check" size={13} />
              {submitting ? 'Đang lưu...' : initialRule ? 'Lưu thay đổi' : 'Tạo quy tắc'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};
