import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Lock,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Pencil,
  Copy,
  Check,
  Zap,
  X,
} from 'lucide-react';
import { Icon } from '../../home/HomeIcons';
import type { DeviceShadowResponse, ManualOverrideRecord } from '../../../types/device';
import { getDeviceOverrideHistory } from '../../../services/deviceApi';
import type { DetailDeviceInput } from './detailTypes';
import { notify } from '../../ui/notify';

export interface SettingsTabProps {
  device: DetailDeviceInput;
  wattage?: number;
  hasCustomWattage?: boolean;
  onSaveWattage?: (newWattage: number) => Promise<boolean>;
  isOverrideActive: boolean;
  formattedTime: string;
  onCancelAutomation: (minutes?: number) => void;
  onResumeAutomation: () => void;
  onExtendAutomation: (hours?: number) => void;
  isCancellingAutomation: boolean;
  isResumingAutomation: boolean;
  isExtendingAutomation: boolean;
  shadow: DeviceShadowResponse | null;
  isCheckingShadow: boolean;
  isReconcilingShadow: boolean;
  onRefreshShadow: () => void;
  onReconcileShadow: () => void;
  onStartRename: () => void;
  onOpenDeleteConfirm: () => void;
}

function SharedDeviceInfo({
  device,
  wattage,
  hasCustomWattage,
  isOverrideActive,
  formattedTime,
  onStartEditWattage,
}: {
  device: DetailDeviceInput;
  wattage?: number;
  hasCustomWattage?: boolean;
  isOverrideActive?: boolean;
  formattedTime?: string;
  onStartEditWattage?: () => void;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = (val: string, key: string) => {
    navigator.clipboard?.writeText(val);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1400);
  };

  const deviceTypeStr = device?.type || device?.deviceType || 'Thiết bị';
  const roomName = device?.room || device?.roomName || 'Chưa phân phòng';

  const devRecord = (device?.raw || device || {}) as Record<string, unknown>;
  const rawState = (device?.raw?.currentState || device?.currentState || {}) as Record<string, unknown>;
  const rawSettings = (device?.raw?.settings || device?.settings || {}) as Record<string, unknown>;

  const macAddress = (rawState.macAddress || rawSettings.macAddress || devRecord.macAddress) as string | undefined;
  const ipAddress = (rawState.ipAddress || rawSettings.ipAddress || devRecord.ipAddress) as string | undefined;
  const firmwareVersion = (rawState.firmwareVersion || rawSettings.firmwareVersion || devRecord.firmwareVersion) as string | undefined;

  const rows: [string, string, boolean][] = [
    ['Mã thiết bị (ID)', String(device?.raw?.id || device?.id || '--'), true],
    ['Loại thiết bị', String(device?.raw?.deviceType || deviceTypeStr), false],
    ['Phòng', roomName, false],
    ['Quyền tự động hóa', isOverrideActive ? `Ghi đè thủ công (${formattedTime || '30:00'})` : 'Tự động hoạt động', false],
    ...(wattage !== undefined
      ? [['Công suất định mức', `${wattage} W ${hasCustomWattage ? '(Tùy chỉnh)' : '(Mặc định)'}`, false] as [string, string, boolean]]
      : []),
    ['Kiểu máy (Model)', String(device?.raw?.model || device?.model || 'HESTA Standard'), false],
    ['Số sê-ri (Serial)', String(device?.raw?.serialNumber || device?.serialNumber || (device?.raw?.id ? String(device.raw.id).slice(0, 8).toUpperCase() : '--')), true],
    ['Node điều khiển (Edge MCU)', String(device?.raw?.nodeName || device?.raw?.nodeId || 'Gateway trung tâm'), false],
    ...(device?.raw?.gpioPin !== undefined && device?.raw?.gpioPin !== null
      ? [['Chân GPIO', `GPIO ${device.raw.gpioPin}`, false] as [string, string, boolean]]
      : []),
    ...(macAddress ? [['Địa chỉ MAC', String(macAddress), true] as [string, string, boolean]] : []),
    ...(ipAddress ? [['Địa chỉ IP', String(ipAddress), true] as [string, string, boolean]] : []),
    ...(firmwareVersion ? [['Phiên bản phần mềm', String(firmwareVersion), false] as [string, string, boolean]] : []),
    (() => {
      const rawStatus = String(device?.raw?.status || (device?.offline ? 'OFFLINE' : 'ONLINE')).toUpperCase();
      const statusDisplay =
        rawStatus === 'ONLINE' && !device?.offline
          ? 'Trực tuyến (ONLINE)'
          : rawStatus === 'UNKNOWN'
          ? 'Không xác định (UNKNOWN)'
          : rawStatus === 'ERROR'
          ? 'Lỗi kết nối (ERROR)'
          : rawStatus === 'UNCLAIMED'
          ? 'Chưa kích hoạt (UNCLAIMED)'
          : 'Ngoại tuyến (OFFLINE)';
      return ['Trạng thái kết nối', statusDisplay, false] as [string, string, boolean];
    })(),
    ['Cập nhật lần cuối', device?.raw?.lastSeen ? new Date(device.raw.lastSeen).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa ghi nhận', false],
  ];

  return (
    <details className="detail-accordion light-info" open>
      <summary className="cursor-pointer">
        <span className="font-semibold text-text">Thông tin thiết bị</span>
        <Icon name="chevronDown" size={17} />
      </summary>
      <div>
        <dl>
          {rows.map(([term, value, canCopy]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd className="flex items-center gap-1.5 justify-end">
                <span>{value}</span>
                {term === 'Công suất định mức' && onStartEditWattage && (
                  <button
                    type="button"
                    onClick={onStartEditWattage}
                    title="Chỉnh sửa công suất định mức"
                    aria-label="Sửa công suất định mức"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] hover:opacity-85 text-[10px] font-bold cursor-pointer transition-opacity"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                    <span>Sửa</span>
                  </button>
                )}
                {canCopy && value !== '--' && (
                  <button
                    type="button"
                    onClick={() => copy(value, term)}
                    title={`Sao chép ${term}`}
                    aria-label={`Sao chép ${term}`}
                    className="inline-flex items-center ml-1 text-muted hover:text-text cursor-pointer"
                  >
                    {copiedKey === term ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}

function AutomationOverrideAccordion({
  deviceId,
  isOverrideActive,
  formattedTime,
  onCancelAutomation,
  onResumeAutomation,
  onExtendAutomation,
  isCancelling,
  isResuming,
  isExtending,
}: {
  deviceId?: string;
  isOverrideActive: boolean;
  formattedTime: string;
  onCancelAutomation: (minutes?: number) => void;
  onResumeAutomation: () => void;
  onExtendAutomation: (hours?: number) => void;
  isCancelling: boolean;
  isResuming: boolean;
  isExtending: boolean;
}) {
  const [overrides, setOverrides] = useState<ManualOverrideRecord[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('60');

  const fetchOverrides = useCallback(() => {
    if (!deviceId) return;
    getDeviceOverrideHistory(deviceId)
      .then((res) => {
        if (Array.isArray(res)) setOverrides(res);
        setHasLoaded(true);
      })
      .catch(() => setHasLoaded(true));
  }, [deviceId]);

  useEffect(() => {
    if (isOverrideActive && deviceId) {
      fetchOverrides();
    }
  }, [isOverrideActive, deviceId, fetchOverrides]);

  return (
    <details
      className="detail-accordion light-info"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open && !hasLoaded) {
          fetchOverrides();
        }
      }}
    >
      <summary className="cursor-pointer">
        <span className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-text">Ghi đè thủ công & Tự động hóa</span>
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
              isOverrideActive
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            }`}
          >
            {isOverrideActive ? `🔒 Khóa ${formattedTime}` : 'Đang tự động'}
          </span>
          <Icon name="chevronDown" size={17} />
        </div>
      </summary>

      <div className="space-y-3 pt-2">
        {isOverrideActive ? (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <strong className="block text-[var(--text)] font-semibold">Đang tạm dừng tự động hóa</strong>
                <span className="text-[var(--secondary)] text-[11px] block mt-0.5">
                  Bỏ qua kịch bản tự động, còn lại: <b className="text-amber-600 dark:text-amber-400 font-mono font-bold">{formattedTime}</b>
                </span>
              </div>
              <button
                type="button"
                disabled={isResuming}
                onClick={onResumeAutomation}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold transition text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isResuming ? 'animate-spin' : ''}`} />
                <span>{isResuming ? 'Đang xử lý…' : 'Khôi phục ngay'}</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-amber-500/20 text-[11px]">
              <span className="text-[var(--secondary)] shrink-0">Gia hạn thêm:</span>
              <button
                type="button"
                disabled={isExtending}
                onClick={() => onExtendAutomation(0.5)}
                className="px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 font-semibold border border-amber-500/30 cursor-pointer disabled:opacity-50"
              >
                +30 phút
              </button>
              <button
                type="button"
                disabled={isExtending}
                onClick={() => onExtendAutomation(1)}
                className="px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 font-semibold border border-amber-500/30 cursor-pointer disabled:opacity-50"
              >
                +1 giờ
              </button>
              <button
                type="button"
                disabled={isExtending}
                onClick={() => onExtendAutomation(4)}
                className="px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 font-semibold border border-amber-500/30 cursor-pointer disabled:opacity-50"
              >
                +4 giờ
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2.5">
            <div>
              <strong className="block text-[var(--text)] font-semibold">Tự động hóa đang hoạt động</strong>
              <span className="text-[var(--secondary)] text-[11px] block mt-0.5">
                Chọn khoảng thời gian bạn muốn tạm dừng để giữ nguyên trạng thái thiết bị:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[
                { label: '30 phút', mins: 30 },
                { label: '1 giờ', mins: 60 },
                { label: '4 giờ', mins: 240 },
                { label: '8 giờ (cả đêm)', mins: 480 },
              ].map((preset) => (
                <button
                  key={preset.mins}
                  type="button"
                  disabled={isCancelling}
                  onClick={() => onCancelAutomation(preset.mins)}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 font-semibold border border-amber-500/30 transition text-xs cursor-pointer disabled:opacity-50"
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowCustom(!showCustom)}
                className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--solid)] text-[var(--secondary)] hover:text-[var(--text)] text-xs font-medium cursor-pointer"
              >
                {showCustom ? 'Đóng tùy chỉnh' : 'Tùy chỉnh…'}
              </button>
            </div>

            {showCustom && (
              <div className="flex items-center gap-2 pt-1 animate-in fade-in">
                <input
                  type="number"
                  min="5"
                  max="1440"
                  step="5"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  placeholder="Số phút"
                  className="w-24 px-2.5 py-1 text-xs rounded-lg border border-[var(--border)] bg-[var(--solid)] text-[var(--text)]"
                />
                <span className="text-xs text-[var(--secondary)]">phút</span>
                <button
                  type="button"
                  disabled={isCancelling || !customMinutes || Number(customMinutes) <= 0}
                  onClick={() => onCancelAutomation(Number(customMinutes))}
                  className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
                >
                  Tạm dừng ngay
                </button>
              </div>
            )}
          </div>
        )}

        {overrides.length > 0 ? (
          <div className="space-y-2 mt-2">
            <span className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
              Lịch sử ghi đè gần đây
            </span>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {overrides.map((ov) => (
                <div
                  key={ov.id}
                  className="flex items-center justify-between text-xs py-2 px-2.5 rounded-lg bg-[var(--solid)] border border-[var(--border)]"
                >
                  <div className="flex items-center gap-2">
                    <span>{ov.action === 'RESUME' ? '🟢' : '🔒'}</span>
                    <span className="font-semibold text-[var(--text)]">
                      {ov.action === 'RESUME'
                        ? 'Khôi phục tự động'
                        : ov.action === 'CANCEL'
                        ? 'Hủy tự động'
                        : 'Ghi đè thủ công'}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted">
                    {new Date(ov.occurredAt).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · {new Date(ov.occurredAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          hasLoaded && (
            <p className="text-center text-xs text-muted py-2">Chưa có lịch sử ghi đè thủ công.</p>
          )
        )}
      </div>
    </details>
  );
}

function DeviceShadowAccordion({
  shadow,
  isReconciling,
  isChecking,
  onReconcile,
  onRefresh,
}: {
  shadow?: DeviceShadowResponse | null;
  isReconciling?: boolean;
  isChecking?: boolean;
  onReconcile?: () => void;
  onRefresh?: () => void;
}) {
  if (!shadow) return null;

  const deltaKeys = Object.keys(shadow.deltaState || {});
  const isInSync = shadow.inSync && deltaKeys.length === 0;

  return (
    <details className="detail-accordion light-info">
      <summary className="cursor-pointer">
        <span className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="font-semibold text-text">Kiểm tra đồng bộ thiết bị</span>
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
              isInSync
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse'
            }`}
          >
            {isInSync && <CheckCircle2 className="w-3 h-3" />}
            <span>{isInSync ? 'Đã khớp hoàn toàn' : `Lệch ${deltaKeys.length} trạng thái`}</span>
          </span>
          <Icon name="chevronDown" size={17} />
        </div>
      </summary>

      <div className="space-y-3 pt-2 text-xs">
        <p className="text-[11px] text-muted leading-relaxed">
          Hệ thống tự động đối chiếu giữa lệnh cài đặt trên ứng dụng và phản hồi thực tế từ thiết bị ngoài đời thực.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-[var(--solid)] border border-[var(--border)] space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] block">
              Lệnh trên ứng dụng
            </span>
            <strong className="text-xs font-semibold text-[var(--text)] block truncate">
              Bản ghi số {shadow.desiredVersion}
            </strong>
            <small className="text-[10px] text-[var(--secondary)] block">
              {shadow.desiredUpdatedAt ? new Date(shadow.desiredUpdatedAt).toLocaleTimeString('vi-VN') : '--'}
            </small>
          </div>

          <div className="p-2.5 rounded-xl bg-[var(--solid)] border border-[var(--border)] space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
              Thiết bị phản hồi
            </span>
            <strong className="text-xs font-semibold text-[var(--text)] block truncate">
              Bản ghi số {shadow.reportedVersion}
            </strong>
            <small className="text-[10px] text-[var(--secondary)] block">
              {shadow.reportedUpdatedAt ? new Date(shadow.reportedUpdatedAt).toLocaleTimeString('vi-VN') : '--'}
            </small>
          </div>
        </div>

        {deltaKeys.length > 0 && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 space-y-1.5">
            <span className="text-[11px] font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Các trạng thái đang chờ thiết bị cập nhật:</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {deltaKeys.map((key) => (
                <code key={key} className="px-2 py-0.5 rounded-md bg-amber-500/20 text-[10px] font-bold font-mono">
                  {key}: {JSON.stringify(shadow.deltaState[key])}
                </code>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isChecking}
            className="px-2.5 py-1 text-[11px] font-semibold rounded-xl border border-[var(--border)] bg-[var(--solid)] text-[var(--secondary)] hover:text-[var(--text)] transition-colors flex items-center gap-1 cursor-pointer"
            title="Làm mới trạng thái đồng bộ"
          >
            <RotateCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          {!isInSync && onReconcile && (
            <button
              type="button"
              onClick={onReconcile}
              disabled={isReconciling}
              className="px-3 py-1 text-[11px] font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
              <span>Gửi lại lệnh đồng bộ</span>
            </button>
          )}
        </div>
      </div>
    </details>
  );
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  device,
  wattage = 40,
  hasCustomWattage = false,
  onSaveWattage,
  isOverrideActive,
  formattedTime,
  onCancelAutomation,
  onResumeAutomation,
  onExtendAutomation,
  isCancellingAutomation,
  isResumingAutomation,
  isExtendingAutomation,
  shadow,
  isCheckingShadow,
  isReconcilingShadow,
  onRefreshShadow,
  onReconcileShadow,
  onStartRename,
  onOpenDeleteConfirm,
}) => {
  const [isEditingWattage, setIsEditingWattage] = useState(false);
  const [wattageInput, setWattageInput] = useState(String(wattage));
  const [isSavingWattage, setIsSavingWattage] = useState(false);

  const handleOpenEditWattage = () => {
    setWattageInput(String(wattage));
    setIsEditingWattage(true);
  };

  const handleConfirmWattage = async () => {
    const parsed = parseInt(wattageInput.trim(), 10);
    if (!wattageInput.trim() || Number.isNaN(parsed) || parsed <= 0 || parsed > 25000) {
      notify.error('Vui lòng nhập công suất hợp lệ (1 – 25000 W)');
      return;
    }
    if (!onSaveWattage) return;
    setIsSavingWattage(true);
    try {
      const ok = await onSaveWattage(parsed);
      if (ok) {
        setIsEditingWattage(false);
      }
    } finally {
      setIsSavingWattage(false);
    }
  };

  return (
    <div className="detail-tab-panel" role="tabpanel" id="device-panel-settings" aria-labelledby="device-tab-settings">
      {/* 1. Rename Quick Action */}
      <div className="p-3 rounded-2xl bg-[var(--g1)] border border-[var(--border)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
            <Pencil className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <strong className="text-xs font-bold text-[var(--text)] block truncate">{device?.name}</strong>
            <span className="text-[11px] text-[var(--secondary)] block truncate">Nhấp để chỉnh sửa tên hiển thị</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onStartRename}
          className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-[var(--border)] bg-[var(--solid)] hover:bg-[var(--muted)] text-[var(--text)] transition cursor-pointer shadow-2xs shrink-0"
        >
          Đổi tên
        </button>
      </div>

      {/* 1B. Rated Wattage Quick Edit Card */}
      <div className="p-3 rounded-2xl bg-[var(--g1)] border border-[var(--border)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <strong className="text-xs font-bold text-[var(--text)]">Công suất định mức</strong>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                  hasCustomWattage
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'bg-[var(--muted)] text-[var(--secondary)]'
                }`}
              >
                {hasCustomWattage ? 'Tùy chỉnh' : 'Mặc định'}
              </span>
            </div>
            <span className="text-[11px] text-[var(--secondary)] block truncate">
              Hiện tại: <b className="text-[var(--accent)]">{wattage} W</b> · Dùng tính kWh & tiền điện EVN
            </span>
          </div>
        </div>

        {isEditingWattage ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="number"
              min={1}
              max={25000}
              value={wattageInput}
              onChange={(e) => setWattageInput(e.target.value)}
              aria-label="Nhập công suất định mức (W)"
              className="w-20 px-2.5 py-1 text-right text-xs font-bold rounded-xl border border-[var(--accent)] bg-[var(--solid)] text-[var(--text)] outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleConfirmWattage();
                if (e.key === 'Escape') setIsEditingWattage(false);
              }}
            />
            <span className="text-xs font-bold text-[var(--secondary)]">W</span>
            <button
              type="button"
              onClick={handleConfirmWattage}
              disabled={isSavingWattage}
              className="px-2.5 py-1 rounded-xl bg-[var(--accent)] text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer flex items-center gap-1"
              title="Lưu công suất định mức"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Lưu</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditingWattage(false)}
              className="p-1.5 rounded-xl border border-[var(--border)] bg-[var(--solid)] text-[var(--secondary)] hover:text-[var(--text)] transition-colors cursor-pointer"
              title="Hủy"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleOpenEditWattage}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-[var(--border)] bg-[var(--solid)] hover:bg-[var(--muted)] text-[var(--text)] transition cursor-pointer shadow-2xs shrink-0 flex items-center gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Đổi công suất</span>
          </button>
        )}
      </div>

      {/* 2. Device Specifications */}
      <SharedDeviceInfo
        device={device}
        wattage={wattage}
        hasCustomWattage={hasCustomWattage}
        isOverrideActive={isOverrideActive}
        formattedTime={formattedTime}
        onStartEditWattage={handleOpenEditWattage}
      />

      {/* 3. Automation Override */}
      <AutomationOverrideAccordion
        deviceId={device?.raw?.id || device?.id}
        isOverrideActive={isOverrideActive}
        formattedTime={formattedTime}
        onCancelAutomation={onCancelAutomation}
        onResumeAutomation={onResumeAutomation}
        onExtendAutomation={onExtendAutomation}
        isCancelling={isCancellingAutomation}
        isResuming={isResumingAutomation}
        isExtending={isExtendingAutomation}
      />

      {/* 4. Shadow Synchronization */}
      <DeviceShadowAccordion
        shadow={shadow}
        isReconciling={isReconcilingShadow}
        isChecking={isCheckingShadow}
        onReconcile={onReconcileShadow}
        onRefresh={onRefreshShadow}
      />

      {/* 5. Danger Zone */}
      <div className="danger-zone-card mt-2">
        <header>
          <Trash2 className="w-4 h-4" />
          <span>Vùng nguy hiểm</span>
        </header>
        <p>
          Xóa thiết bị khỏi hệ thống nhà thông minh. Thiết bị sẽ bị ngắt kết nối và toàn bộ kịch bản tự động hóa liên quan sẽ dừng lại.
        </p>
        <button
          type="button"
          onClick={onOpenDeleteConfirm}
        >
          Xóa thiết bị này
        </button>
      </div>
    </div>
  );
};
