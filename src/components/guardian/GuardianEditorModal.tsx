import React, { useState, useEffect } from 'react';
import { Icon } from '../ui/LucideIcon';
import type { ParentalGuardianRule, CreateGuardianRuleInput } from '../../types/guardian';
import { getDevices } from '../../services/sceneApi';
import type { DeviceSummary } from '../../types/automation';
import { isDeviceControllable, getDeviceTypeLabel } from '../scene/DevicePickerSheet';
import toast from 'react-hot-toast';

interface GuardianEditorModalProps {
  homeId: string;
  initialRule?: ParentalGuardianRule | null;
  onClose: () => void;
  onSave: (input: CreateGuardianRuleInput) => Promise<void>;
}

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];
const WARNING_PRESETS = [1, 3, 5, 10, 15];

const looksLikeScreen = (d: DeviceSummary) => {
  const text = `${d.deviceType || ''} ${d.name || ''}`.toLowerCase();
  return ['plug', 'socket', 'tv', 'tivi', 'máy tính', 'ổ cắm'].some((k) => text.includes(k));
};
const isCamera = (d: DeviceSummary) => {
  const text = `${d.deviceType || ''} ${d.name || ''}`.toLowerCase();
  return text.includes('camera') || text.includes('cam ');
};
const deviceLabel = (d: DeviceSummary) => [d.name, d.roomName || d.room].filter(Boolean).join(' · ');

export const GuardianEditorModal: React.FC<GuardianEditorModalProps> = ({
  homeId,
  initialRule,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(initialRule?.name || 'Giới hạn xem TV khi vắng nhà');
  const [targetDeviceIds, setTargetDeviceIds] = useState<string[]>(
    () => initialRule?.targetDevices.map((d) => d.id) ?? [],
  );
  const [useCamera, setUseCamera] = useState(!!initialRule?.cameraDeviceId);
  const [cameraDeviceId, setCameraDeviceId] = useState(initialRule?.cameraDeviceId || '');
  const [allowedDuration, setAllowedDuration] = useState(initialRule?.allowedDurationMinutes || 45);
  const [warningMinutes, setWarningMinutes] = useState(initialRule?.warningMinutesBefore || 5);
  const [autoLockout, setAutoLockout] = useState(initialRule ? initialRule.autoLockout : true);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [deviceQuery, setDeviceQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    getDevices(homeId)
      .then((data) => {
        if (!active) return;
        setDevices(data);
        // Preselect the first TV / smart plug for a new rule.
        setTargetDeviceIds((current) => {
          if (current.length) return current;
          const controllable = data.filter(isDeviceControllable);
          const first = controllable.find(looksLikeScreen) || controllable[0];
          return first ? [first.id] : [];
        });
      })
      .catch(() => toast.error('Không thể tải danh sách thiết bị'));
    return () => {
      active = false;
    };
  }, [homeId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !submitting && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  const targets = devices.filter(isDeviceControllable);
  const cameras = devices.filter(isCamera);
  const selectedTargets = targets.filter((d) => targetDeviceIds.includes(d.id));
  const query = deviceQuery.trim().toLowerCase();
  const shownTargets = query
    ? targets.filter((d) =>
        [d.name, d.roomName, d.room, getDeviceTypeLabel(d)].some((text) => text?.toLowerCase().includes(query)),
      )
    : targets;
  const toggleTarget = (id: string) =>
    setTargetDeviceIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  const warningTooLong = warningMinutes >= allowedDuration;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Vui lòng nhập tên quy tắc');
    if (!targetDeviceIds.length) return toast.error('Vui lòng chọn ít nhất một thiết bị cần giới hạn');
    if (useCamera && !cameraDeviceId) return toast.error('Vui lòng chọn camera nhận diện');
    if (warningTooLong) return toast.error('Thời gian nhắc phải ngắn hơn thời lượng cho phép');

    setSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        targetDeviceIds,
        cameraDeviceId: useCamera ? cameraDeviceId : undefined,
        allowedDurationMinutes: allowedDuration,
        warningMinutesBefore: warningMinutes,
        autoLockout,
      });
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi lưu quy tắc');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="gd-overlay" onClick={() => !submitting && onClose()}>
      <form
        className="gd-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gd-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header className="gd-head">
          <span className="gd-badge">
            <Icon name="shield" size={20} />
          </span>
          <div>
            <h2 id="gd-title">{initialRule ? 'Sửa quy tắc giám hộ' : 'Quy tắc giám hộ mới'}</h2>
            <p>Giới hạn thời gian dùng thiết bị của con khi bố mẹ vắng nhà.</p>
          </div>
          <button type="button" className="st-icon-btn" onClick={onClose} aria-label="Đóng">
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="gd-body">
          <label className="gd-field">
            <span className="gd-label">Tên quy tắc</span>
            <input
              className="gd-input"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Giới hạn TV phòng khách"
              required
            />
          </label>

          <fieldset className="gd-field">
            <div className="gd-label-row">
              <legend className="gd-label">Thiết bị cần giới hạn</legend>
              <strong className="gd-value">{selectedTargets.length} đã chọn</strong>
            </div>
            {targets.length === 0 ? (
              <span className="gd-hint">Nhà chưa có thiết bị điều khiển được.</span>
            ) : (
              <>
                <input
                  type="search"
                  className="gd-input"
                  value={deviceQuery}
                  onChange={(e) => setDeviceQuery(e.target.value)}
                  placeholder="Tìm theo tên, phòng hoặc loại thiết bị…"
                  aria-label="Tìm thiết bị cần giới hạn"
                />
                {shownTargets.length === 0 && <span className="gd-hint">Không có thiết bị nào khớp “{deviceQuery}”.</span>}
                <div className="gd-devices">
                  {shownTargets.map((dev) => (
                    <label key={dev.id} className={`gd-device ${targetDeviceIds.includes(dev.id) ? 'active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={targetDeviceIds.includes(dev.id)}
                        onChange={() => toggleTarget(dev.id)}
                      />
                      <span>
                        <strong>{dev.name}</strong>
                        <small>{[getDeviceTypeLabel(dev), dev.roomName || dev.room].filter(Boolean).join(' · ')}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
            <span className="gd-hint">
              Các thiết bị dùng chung một hạn mức: đồng hồ bắt đầu khi con bật bất kỳ thiết bị nào lúc bố mẹ vắng nhà,
              hết giờ thì tắt tất cả.
            </span>
          </fieldset>

          <div className="gd-field">
            <span className="gd-label">Khi nào coi là vắng nhà</span>
            <div className="st-seg gd-seg" role="radiogroup" aria-label="Cách bật chế độ vắng nhà">
              <button
                type="button"
                role="radio"
                aria-checked={!useCamera}
                className={!useCamera ? 'active' : ''}
                onClick={() => setUseCamera(false)}
              >
                Tự bấm “Vắng nhà”
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={useCamera}
                className={useCamera ? 'active' : ''}
                onClick={() => setUseCamera(true)}
              >
                <Icon name="camera" size={15} />
                Camera nhận diện
              </button>
            </div>
            {useCamera && (
              <select
                className="gd-input"
                value={cameraDeviceId}
                onChange={(e) => setCameraDeviceId(e.target.value)}
                aria-label="Camera nhận diện"
              >
                <option value="">{cameras.length ? 'Chọn camera…' : 'Nhà chưa có camera'}</option>
                {cameras.map((dev) => (
                  <option key={dev.id} value={dev.id}>
                    {deviceLabel(dev)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="gd-field">
            <div className="gd-label-row">
              <span className="gd-label">Thời lượng mỗi lần dùng</span>
              <strong className="gd-value">{allowedDuration} phút</strong>
            </div>
            <div className="gd-chips">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={allowedDuration === preset ? 'active' : ''}
                  aria-pressed={allowedDuration === preset}
                  onClick={() => setAllowedDuration(preset)}
                >
                  {preset}′
                </button>
              ))}
            </div>
            <input
              type="range"
              className="gd-range"
              min={5}
              max={240}
              step={5}
              value={allowedDuration}
              onChange={(e) => setAllowedDuration(Number(e.target.value))}
              aria-label="Thời lượng mỗi lần dùng (phút)"
            />
          </div>

          <div className="gd-field">
            <div className="gd-label-row">
              <span className="gd-label">Nhắc trước khi tắt</span>
              <strong className="gd-value">{warningMinutes} phút</strong>
            </div>
            <div className="gd-chips">
              {WARNING_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={warningMinutes === preset ? 'active' : ''}
                  aria-pressed={warningMinutes === preset}
                  disabled={preset >= allowedDuration}
                  onClick={() => setWarningMinutes(preset)}
                >
                  {preset}′
                </button>
              ))}
            </div>
            <span className={`gd-hint ${warningTooLong ? 'error' : ''}`}>
              {warningTooLong
                ? 'Thời gian nhắc phải ngắn hơn thời lượng cho phép.'
                : 'Bạn nhận thông báo khi sắp hết giờ để kịp nhắc con.'}
            </span>
          </div>

          <div className="gd-switch-row">
            <div>
              <strong>
                <Icon name="lock" size={15} /> Chặn bật lại khi hết giờ
              </strong>
              <p>Nếu con bật lại thiết bị trong thời gian khóa, HESTA sẽ tắt ngay và báo cho bạn.</p>
            </div>
            <button
              type="button"
              className={`toggle ${autoLockout ? 'active' : ''}`}
              aria-pressed={autoLockout}
              aria-label="Chặn bật lại khi hết giờ"
              onClick={() => setAutoLockout(!autoLockout)}
            >
              <span />
            </button>
          </div>
        </div>

        <footer className="gd-foot">
          <p>
            Khi vắng nhà,{' '}
            <b>{selectedTargets.length > 1 ? `${selectedTargets.length} thiết bị` : selectedTargets[0]?.name || 'thiết bị'}</b>{' '}
            được dùng chung tối đa <b>{allowedDuration} phút</b> mỗi lần
            {autoLockout ? ', sau đó bị khóa.' : '.'}
          </p>
          <div>
            <button type="button" className="st-btn" onClick={onClose} disabled={submitting}>
              Hủy
            </button>
            <button type="submit" className="st-btn st-btn-primary" disabled={submitting || !targetDeviceIds.length}>
              {submitting ? 'Đang lưu…' : initialRule ? 'Lưu thay đổi' : 'Tạo quy tắc'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
};
