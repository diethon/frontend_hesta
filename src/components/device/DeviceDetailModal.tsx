import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { HexColorPicker } from 'react-colorful';
import {
  Zap,
  Check,
  X,
  Pencil,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  RotateCw,
  CheckCircle2,
  Layers,
  Lock,
} from 'lucide-react';
import { Icon, type IconName } from '../home/HomeIcons';
import type { DeviceResponse } from '../../types/device';
import {
  sendDeviceCommand,
  updateDeviceConfig,
  removeDevice,
  getDeviceEnergy,
  getDeviceUptime,
  getDeviceHistory,
  getDeviceHealth,
  exportDeviceHistoryCsv,
  exportDeviceHistoryExcel,
  getDeviceShadow,
  reconcileDeviceShadow,
  cancelDeviceAutomation,
  resumeDeviceAutomation,
  extendDeviceAutomation,
  getDeviceOverrideHistory,
} from '../../services/deviceApi';
import type { DeviceEnergyBreakdown } from '../../types/energy';
import type {
  DeviceUptimeResponse,
  DeviceHealthResponse,
  DeviceStateHistoryResponse,
  DeviceShadowResponse,
  ManualOverrideRecord,
} from '../../types/device';
import { useOverrideCountdown } from './useOverrideCountdown';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';
import { resolveDeviceRgb, rgbToHex } from './deviceHelpers';

export type FigmaDeviceType = 'Đèn' | 'Điều hòa' | 'Cảm biến' | 'Cổng' | 'Công tắc' | 'Camera';

export interface DeviceDetailModalProps {
  device: any;
  isOpen?: boolean;
  onClose: () => void;
  placement?: 'side' | 'center';
  onDeviceUpdated?: (updated: DeviceResponse) => void;
  onDeviceRemoved?: (deviceId: string) => void;
  onTogglePower?: () => void;
  onColorChange?: (r: number, g: number, b: number) => void;
  onBrightnessChange?: (brightness: number) => void;
  isPowerPending?: boolean;
}

function SegmentedControl({
  items,
  value,
  setValue,
  disabled = false,
}: {
  items: string[];
  value: string;
  setValue: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="detail-segments">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          disabled={disabled}
          className={item === value ? 'active' : ''}
          onClick={() => setValue(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function DetailToggle({
  on,
  setOn,
  disabled = false,
}: {
  on: boolean;
  setOn: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`toggle ${on ? 'active' : ''}`}
      onClick={() => setOn(!on)}
      aria-pressed={on}
    >
      <span />
    </button>
  );
}

function DetailAccordion({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="detail-accordion">
      <summary>
        {title}
        <Icon name="chevronDown" size={17} />
      </summary>
      <div>{children}</div>
    </details>
  );
}

const lightColors = [
  '#f5d6a0',
  '#f1a991',
  '#d9b8f4',
  '#91b8f1',
  '#9ed9c2',
  '#fff1c9',
  '#d8e4ff',
  '#ffffff',
];

function LightPowerPreview({
  on,
  level,
  disabled,
  color,
  onToggle,
}: {
  on: boolean;
  level: number;
  disabled: boolean;
  color?: string;
  onToggle: () => void;
}) {
  return (
    <section className={`light-power-preview ${on ? 'on' : 'off'}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        aria-label={on ? 'Tắt đèn' : 'Bật đèn'}
        style={
          on && color
            ? {
                color: color,
                filter: `drop-shadow(0 0 16px ${color}80)`,
              }
            : undefined
        }
      >
        <Icon name="lamp" size={40} />
      </button>
      <strong>{on ? `Đang bật · ${level}%` : 'Đang tắt'}</strong>
      <small>{on ? 'Chạm để tắt' : 'Chạm để bật'}</small>
    </section>
  );
}

function PillSlider({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <div className="light-pill-slider">
      <span style={{ width: `${value}%` }} />
      <i style={{ left: `calc(${value}% - 14px)` }} />
      <b>{value}%</b>
      <input
        aria-label={label}
        type="range"
        min="1"
        max="100"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

export interface CustomColorItem {
  id: string;
  name: string;
  hex: string;
  rgb?: [number, number, number];
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  const num = parseInt(clean, 16) || 0;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function ColorCreationSheet({
  currentColor,
  editColor,
  onClose,
  onSave,
}: {
  currentColor: string;
  editColor?: CustomColorItem | null;
  onClose: () => void;
  onSave: (name: string, color: string, id?: string) => void;
}) {
  const [color, setColor] = useState(() => editColor?.hex || currentColor || '#f5d6a0');
  const [name, setName] = useState(() => editColor?.name || '');

  const handleSave = () => {
    if (!name.trim()) return;
    const cleanHex = color.startsWith('#') ? color : `#${color}`;
    onSave(name.trim(), cleanHex, editColor?.id);
    onClose();
  };

  return (
    <div className="color-sheet-layer">
      <button
        type="button"
        className="color-sheet-scrim"
        onClick={onClose}
        aria-label="Đóng"
      />
      <section className="color-creation-sheet glass-g2">
        <div className="sheet-handle" />
        <header>
          <strong>{editColor ? 'Chỉnh sửa màu' : 'Thêm màu mới'}</strong>
        </header>
        <div className="color-sheet-content">
          <div className="color-sheet-preview">
            <span style={{ background: color }}>
              <Icon name="lamp" size={26} />
            </span>
            <strong>{color.toUpperCase()}</strong>
            <small>Xem trước</small>
          </div>

          <div className="custom-color-picker-wrap">
            <HexColorPicker
              color={color.startsWith('#') && color.length === 7 ? color : '#f5d6a0'}
              onChange={setColor}
            />
          </div>

          <div className="custom-color">
            <label>
              Mã màu HEX{' '}
              <input
                value={color.toUpperCase()}
                onChange={(event) => setColor(event.target.value)}
                placeholder="#FFFFFF"
              />
            </label>
            <button
              type="button"
              className="use-current"
              onClick={() => setColor(currentColor)}
            >
              Dùng màu hiện tại
            </button>
          </div>

          <div className="quick-color-swatches flex gap-2 overflow-x-auto py-1">
            {lightColors.map((c) => (
              <button
                key={c}
                type="button"
                style={{ background: c }}
                title={`Chọn ${c}`}
                className={`w-7 h-7 rounded-full shrink-0 border border-black/10 transition-transform ${
                  color.toLowerCase() === c.toLowerCase() ? 'scale-110 ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setColor(c)}
              />
            ))}
          </div>

          <label className="color-name-field">
            <span>
              Tên màu <small>{name.length}/20</small>
            </span>
            <input
              maxLength={20}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="VD: Chơi game, Đêm muộn, Cà phê"
              autoFocus
            />
          </label>
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            Hủy
          </button>
          <button type="button" disabled={!name.trim()} onClick={handleSave}>
            Lưu màu
          </button>
        </footer>
      </section>
    </div>
  );
}

function SavedColors({
  saved,
  disabled,
  onApply,
  onAddClick,
  onEditClick,
  onDeleteClick,
}: {
  saved: CustomColorItem[];
  disabled: boolean;
  onApply: (color: string) => void;
  onAddClick: () => void;
  onEditClick: (item: CustomColorItem) => void;
  onDeleteClick: (item: CustomColorItem) => void;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<CustomColorItem | null>(null);

  const handleDelete = () => {
    if (deleteConfirmItem) {
      onDeleteClick(deleteConfirmItem);
      setDeleteConfirmItem(null);
      setMenu(null);
    }
  };

  return (
    <section
      className={`detail-section light-disableable ${
        disabled ? 'disabled' : ''
      }`}
    >
      <div className="saved-color-heading">
        <h3>Màu đã lưu</h3>
        <small>{`${saved.length}/12`}</small>
      </div>
      {saved.length === 0 && <p className="saved-empty">Chưa có màu nào được lưu</p>}
      <div className="named-colors">
        {saved.map((item) => (
          <span className="named-color-wrap" key={item.id || item.name}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onApply(item.hex);
                setMenu(menu === item.id ? null : item.id);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu(item.id);
              }}
            >
              <i style={{ background: item.hex }} />
              {item.name}
              {menu === item.id && <b>⋯</b>}
            </button>
            {menu === item.id && (
              <span className="saved-color-menu glass-g2">
                <button
                  type="button"
                  onClick={() => {
                    onEditClick(item);
                    setMenu(null);
                  }}
                >
                  Đổi màu
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    setDeleteConfirmItem(item);
                    setMenu(null);
                  }}
                >
                  Xóa
                </button>
              </span>
            )}
          </span>
        ))}
        <button
          type="button"
          disabled={disabled || saved.length >= 12}
          className="named-add-color"
          onClick={onAddClick}
        >
          + Thêm màu
        </button>
      </div>
      {saved.length >= 12 && (
        <small className="saved-limit">Đã đủ 12 màu · Xóa bớt để thêm</small>
      )}
      {deleteConfirmItem && (
        <span className="saved-delete-confirm glass-g2">
          <strong>Xóa màu “{deleteConfirmItem.name}”?</strong>
          <small>Thao tác này không thể hoàn tác.</small>
          <span>
            <button type="button" onClick={() => setDeleteConfirmItem(null)}>
              Hủy
            </button>
            <button type="button" className="danger" onClick={handleDelete}>
              Xóa
            </button>
          </span>
        </span>
      )}
    </section>
  );
}

function SharedDeviceInfo({
  device,
  expanded = false,
  wattage,
  hasCustomWattage,
  isOverrideActive,
  formattedTime,
}: {
  device: any;
  expanded?: boolean;
  wattage?: number;
  hasCustomWattage?: boolean;
  isOverrideActive?: boolean;
  formattedTime?: string;
}) {
  const [toast, setToast] = useState(false);
  const copy = (val: string) => {
    navigator.clipboard?.writeText(val);
    setToast(true);
    window.setTimeout(() => setToast(false), 1400);
  };

  const deviceTypeStr = device.type || device.deviceType || 'Thiết bị';
  const roomName = device.room || device.roomName || 'Chưa phân phòng';

  const rows: [string, string][] = [
    ['Loại', deviceTypeStr],
    ['Phòng', roomName],
    ['Quyền tự động hóa', isOverrideActive ? `Đang ghi đè thủ công (${formattedTime || '30:00'})` : 'Tự động hoạt động'],
    ...(wattage !== undefined
      ? [['Công suất định mức', `${wattage} W ${hasCustomWattage ? '(Tùy chỉnh)' : '(Mặc định)'}`] as [string, string]]
      : []),
    ['Thương hiệu', device.raw?.manufacturer || device.brand || 'HESTA'],
    ['Mã kiểu máy', device.raw?.model || device.model || '--'],
    ['Số sê-ri', device.raw?.serialNumber || device.serialNumber || device.raw?.id || device.id],
    ['Địa chỉ MAC', device.raw?.macAddress || device.macAddress || '--'],
    ['Địa chỉ IP', device.raw?.ipAddress || device.ipAddress || '--'],
    ['Giao thức kết nối', device.raw?.protocol || (device.raw?.nodeId ? 'Mạng lưới Zigbee' : 'Wi-Fi 2.4 GHz')],
    ['Cường độ tín hiệu', device.raw?.currentState?.rssi ? `${device.raw.currentState.rssi} dBm` : (device.offline ? 'Ngoại tuyến' : 'Trực tuyến')],
    ['Phiên bản phần mềm', device.raw?.firmwareVersion || device.firmwareVersion || '--'],
    ['Cập nhật lần cuối', device.raw?.lastSeen ? new Date(device.raw.lastSeen).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong'],
  ];

  return (
    <>
      <details className="detail-accordion light-info" open={expanded}>
        <summary>
          Thông tin thiết bị
          <Icon name="chevronDown" size={17} />
        </summary>
        <div>
          <dl>
            {rows.map(([term, value], index) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>
                  {value}
                  {index >= 4 && index <= 6 && (
                    <button
                      type="button"
                      onClick={() => copy(value)}
                      title={`Sao chép ${term}`}
                      aria-label={`Sao chép ${term}`}
                    >
                      □
                    </button>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </details>
      {toast && <div className="copy-toast">Đã sao chép vào bộ nhớ tạm</div>}
    </>
  );
}

function EnergyUsageCard({
  title = 'Năng lượng tiêu thụ',
  stats,
  bars,
  lastSeen,
  wattage,
  hasCustomWattage,
  isEditingWattage,
  editWattage,
  isSavingWattage,
  onStartEditWattage,
  onCancelEditWattage,
  onSaveWattage,
  onChangeEditWattage,
}: {
  _state?: string | null;
  title?: string;
  stats?: [string, string, string][];
  bars?: number[];
  lastSeen?: boolean;
  wattage?: number;
  hasCustomWattage?: boolean;
  isEditingWattage?: boolean;
  editWattage?: string;
  isSavingWattage?: boolean;
  onStartEditWattage?: () => void;
  onCancelEditWattage?: () => void;
  onSaveWattage?: () => void;
  onChangeEditWattage?: (val: string) => void;
}) {
  const [range, setRange] = useState('30 ngày');
  const displayBars = bars && bars.length > 0 ? bars : [12, 28, 45, 32, 65, 48, 58, 38, 72, 54];

  return (
    <section className="light-metric-card glass-g1">
      <header>
        <div>
          <Icon name="energy" size={18} />
          <strong>{title}</strong>
        </div>
        <SegmentedControl
          items={['7 ngày', '30 ngày']}
          value={range}
          setValue={setRange}
        />
      </header>
      {lastSeen && <p className="data-until">Thiết bị đang ngoại tuyến</p>}
      <div className="energy-stats">
        {stats && stats.length > 0 ? (
          stats.map(([label, value, unit]) => (
            <span key={label}>
              <small>{label}</small>
              <strong>
                {value} <i>{unit}</i>
              </strong>
            </span>
          ))
        ) : (
          <span className="text-xs text-muted">Chưa có dữ liệu thống kê điện năng</span>
        )}
      </div>

      {/* Wattage Configuration */}
      {wattage !== undefined && (
        <div className="p-3 rounded-2xl bg-surface/80 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Công suất định mức</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                    hasCustomWattage
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {hasCustomWattage ? 'Tùy chỉnh' : 'Mặc định'}
                </span>
              </div>
              <p className="text-[10px] text-muted">
                Dùng tính toán lượng điện tiêu thụ kWh và tiền điện EVN
              </p>
            </div>
          </div>

          {isEditingWattage ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="number"
                min={1}
                max={15000}
                value={editWattage}
                onChange={(e) => onChangeEditWattage?.(e.target.value)}
                placeholder={String(wattage)}
                className="w-20 px-2 py-1 text-right text-xs font-bold rounded-xl border border-primary bg-surface text-text outline-none focus:ring-2 focus:ring-primary/20"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveWattage?.();
                  if (e.key === 'Escape') onCancelEditWattage?.();
                }}
              />
              <span className="text-xs font-bold text-muted">W</span>
              <button
                type="button"
                onClick={onSaveWattage}
                disabled={isSavingWattage}
                className="p-1.5 rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50 cursor-pointer"
                title="Lưu công suất"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onCancelEditWattage}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-muted hover:text-text transition-colors cursor-pointer"
                title="Hủy"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <strong className="text-sm font-bold text-primary">{wattage} W</strong>
              <button
                type="button"
                onClick={onStartEditWattage}
                className="p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700 hover:border-primary/50 text-muted hover:text-primary transition-colors cursor-pointer"
                title="Tùy chỉnh công suất thiết bị"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="light-bar-chart">
        {displayBars.map((height, index) => (
          <button
            type="button"
            key={index}
            title={`${(height / 20).toFixed(1)} kWh`}
            className={height >= 70 ? 'peak' : ''}
          >
            <i style={{ height: `${Math.max(8, height)}%` }} />
          </button>
        ))}
      </div>
      <button type="button" className="metric-link">
        Xem chi tiết
      </button>
    </section>
  );
}

function ActivityFrequencyCard({
  initialTab = 'Tần suất',
  title = 'Tần suất hoạt động',
  stats,
  events,
  timelineMinutes,
  uptimePercent,
  lastSeen,
  deviceId,
  deviceName,
}: {
  _state?: string | null;
  initialTab?: string;
  title?: string;
  stats?: [string, string][];
  events?: [string, string, string][];
  timelineMinutes?: number[];
  uptimePercent?: number;
  lastSeen?: boolean;
  deviceId?: string;
  deviceName?: string;
}) {
  const [tab, setTab] = useState(initialTab);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const minutes = timelineMinutes && timelineMinutes.length === 24
    ? timelineMinutes
    : Array(24).fill(0);

  const handleExportCsv = async () => {
    if (!deviceId) return;
    setIsExportingCsv(true);
    try {
      const cleanName = (deviceName || 'thiet_bi').replace(/\s+/g, '_');
      await exportDeviceHistoryCsv(deviceId, `lich_su_${cleanName}.csv`);
      notify.success('Đã xuất báo cáo CSV thành công');
    } catch (err) {
      console.warn('Export CSV error:', err);
      notify.error('Lỗi khi xuất file CSV');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleExportExcel = async () => {
    if (!deviceId) return;
    setIsExportingExcel(true);
    try {
      const cleanName = (deviceName || 'thiet_bi').replace(/\s+/g, '_');
      await exportDeviceHistoryExcel(deviceId, `lich_su_${cleanName}.xlsx`);
      notify.success('Đã tải xuống file báo cáo Excel (.xlsx) thành công');
    } catch (err) {
      console.warn('Export Excel error:', err);
      notify.error('Lỗi khi xuất file Excel');
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <section className="light-metric-card glass-g1">
      <header>
        <div>
          <strong>{title}</strong>
          <small>7 ngày qua</small>
        </div>
        {uptimePercent !== undefined && (
          <span className="usage-chip">{uptimePercent}%</span>
        )}
      </header>
      <SegmentedControl
        items={['Tần suất', 'Lịch sử']}
        value={tab}
        setValue={setTab}
      />
      {lastSeen && <p className="data-until">Thiết bị đang ngoại tuyến</p>}
      {tab === 'Tần suất' ? (
        <>
          {stats && stats.length > 0 ? (
            <div className={`usage-stats ${stats.length === 4 ? 'four' : ''}`}>
              {stats.map(([label, value]) => (
                <span key={label}>
                  <small>{label}</small>
                  <b>{value}</b>
                </span>
              ))}
            </div>
          ) : null}
          <div className="hour-timeline">
            {minutes.map((value, hour) => (
              <button
                type="button"
                key={hour}
                title={`${String(hour).padStart(2, '0')}:00 – ${String(hour + 1).padStart(2, '0')}:00 · ${value} phút`}
                style={{ opacity: value ? Math.max(0.25, value / 60) : 1 }}
                className={value ? 'active' : ''}
              />
            ))}
          </div>
          <div className="timeline-axis">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
          <p className="timeline-hint">Di chuột để xem số phút bật</p>
          <div className="timeline-legend">
            <span>
              <i className="on" />
              Bật
            </span>
            <span>
              <i />
              Tắt
            </span>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-semibold text-secondary">
              Lịch sử ghi nhận gần đây
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isExportingCsv}
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl border border-slate-200/80 dark:border-slate-700 bg-surface hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                title="Xuất file CSV báo cáo lịch sử hoạt động"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                <span>{isExportingCsv ? 'Đang xuất…' : 'Xuất CSV'}</span>
              </button>

              <button
                type="button"
                disabled={isExportingExcel}
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                title="Xuất báo cáo Excel (.xlsx) kiểm toán 30 ngày qua"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{isExportingExcel ? 'Đang xuất…' : 'Xuất Excel'}</span>
              </button>
            </div>
          </div>

          <div className="light-history">
            {events && events.length > 0 ? (
              events.map(([icon, text, time], idx) => (
                <div key={`${text}-${idx}`}>
                  <span>
                    <Icon name={icon as IconName} size={17} />
                  </span>
                  <strong>{text}</strong>
                  <small>{time}</small>
                </div>
              ))
            ) : (
              <div style={{ padding: '1.5rem', textAlign: 'center', opacity: 0.6 }}>
                Chưa có lịch sử hoạt động ghi nhận
              </div>
            )}
          </div>
        </div>
      )}
    </section>
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
          <span>Kiểm tra đồng bộ thiết bị</span>
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
          <div className="p-2.5 rounded-xl bg-surface/80 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
              Lệnh trên ứng dụng
            </span>
            <strong className="text-xs font-semibold text-text block truncate">
              Bản ghi số {shadow.desiredVersion}
            </strong>
            <small className="text-[10px] text-muted block">
              {shadow.desiredUpdatedAt ? new Date(shadow.desiredUpdatedAt).toLocaleTimeString('vi-VN') : '--'}
            </small>
          </div>

          <div className="p-2.5 rounded-xl bg-surface/80 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
              Thiết bị ngoài đời phản hồi
            </span>
            <strong className="text-xs font-semibold text-text block truncate">
              Bản ghi số {shadow.reportedVersion}
            </strong>
            <small className="text-[10px] text-muted block">
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

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isChecking}
            className="px-2.5 py-1 text-[11px] font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-muted hover:text-text transition-colors flex items-center gap-1 cursor-pointer"
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
          <span>Ghi đè thủ công & Tự động hóa</span>
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
                <strong className="block text-foreground font-semibold">Đang tạm dừng tự động hóa</strong>
                <span className="text-muted text-[11px] block mt-0.5">
                  Bỏ qua kịch bản tự động, thời gian còn lại: <b className="text-amber-600 dark:text-amber-400 font-mono font-bold">{formattedTime}</b>
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
              <span className="text-muted shrink-0">Gia hạn thêm:</span>
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
              <strong className="block text-foreground font-semibold">Tự động hóa đang hoạt động</strong>
              <span className="text-muted text-[11px] block mt-0.5">
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
                className="px-2.5 py-1.5 rounded-lg border border-line text-muted hover:text-foreground text-xs font-medium cursor-pointer"
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
                  className="w-24 px-2.5 py-1 text-xs rounded-lg border border-line bg-background text-foreground"
                />
                <span className="text-xs text-muted">phút</span>
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
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
              Lịch sử ghi đè gần đây
            </span>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {overrides.map((ov) => (
                <div
                  key={ov.id}
                  className="flex items-center justify-between text-xs py-2 px-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-line"
                >
                  <div className="flex items-center gap-2">
                    <span>{ov.action === 'RESUME' ? '🟢' : '🔒'}</span>
                    <span className="font-semibold text-foreground">
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

function DeviceTail({
  device,
  offline,
  onDeviceUpdated,
  shadow,
  isReconcilingShadow,
  isCheckingShadow,
  onReconcileShadow,
  onRefreshShadow,
}: {
  device: any;
  offline: boolean;
  onDeviceUpdated?: (updated: any) => void;
  shadow?: DeviceShadowResponse | null;
  isReconcilingShadow?: boolean;
  isCheckingShadow?: boolean;
  onReconcileShadow?: () => void;
  onRefreshShadow?: () => void;
}) {
  const [energyData, setEnergyData] = useState<DeviceEnergyBreakdown | null>(null);
  const [uptimeData, setUptimeData] = useState<DeviceUptimeResponse | null>(null);
  const [historyData, setHistoryData] = useState<DeviceStateHistoryResponse[]>([]);
  const [healthData, setHealthData] = useState<DeviceHealthResponse | null>(null);

  // Wattage configuration states
  const [isEditingWattage, setIsEditingWattage] = useState(false);
  const [editWattage, setEditWattage] = useState('');
  const [isSavingWattage, setIsSavingWattage] = useState(false);

  // Automation manual override states
  const overrideUntil = device.manualOverrideUntil || device.raw?.manualOverrideUntil;
  const { isOverrideActive, formattedTime } = useOverrideCountdown(overrideUntil);
  const [isResumingAutomation, setIsResumingAutomation] = useState(false);
  const [isCancellingAutomation, setIsCancellingAutomation] = useState(false);
  const [isExtendingAutomation, setIsExtendingAutomation] = useState(false);

  const handleResumeAutomation = async () => {
    const devId = device?.raw?.id || device?.id;
    if (!devId) return;
    setIsResumingAutomation(true);
    try {
      await resumeDeviceAutomation(devId);
      notify.success('Đã khôi phục tự động hóa', 'Quy tắc và kịch bản tự động sẽ tiếp tục điều khiển thiết bị');
      if (device.raw) {
        device.raw.manualOverrideUntil = null;
        device.raw.manualOverrideActive = false;
      }
      device.manualOverrideUntil = null;
      device.manualOverrideActive = false;
      onDeviceUpdated?.({
        ...(device.raw || device),
        manualOverrideUntil: null,
        manualOverrideActive: false,
      });
    } catch (err) {
      notify.error(getErrorMessage(err, 'Lỗi khi khôi phục tự động hóa'));
    } finally {
      setIsResumingAutomation(false);
    }
  };

  const handleCancelAutomation = async (minutes: number = 30) => {
    const devId = device?.raw?.id || device?.id;
    if (!devId) return;
    setIsCancellingAutomation(true);
    try {
      const newUntil = await cancelDeviceAutomation(devId, minutes);
      const untilStr = newUntil || new Date(Date.now() + minutes * 60 * 1000).toISOString();
      const label = minutes >= 60
        ? `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)} giờ`
        : `${minutes} phút`;
      notify.success('Đã tạm dừng tự động hóa', `Thiết bị được ưu tiên điều khiển thủ công trong ${label}`);
      if (device.raw) {
        device.raw.manualOverrideUntil = untilStr;
        device.raw.manualOverrideActive = true;
      }
      device.manualOverrideUntil = untilStr;
      device.manualOverrideActive = true;
      onDeviceUpdated?.({
        ...(device.raw || device),
        manualOverrideUntil: untilStr,
        manualOverrideActive: true,
      });
    } catch (err) {
      notify.error(getErrorMessage(err, 'Lỗi khi tạm dừng tự động hóa'));
    } finally {
      setIsCancellingAutomation(false);
    }
  };

  const handleExtendAutomation = async (hours: number = 1) => {
    const devId = device?.raw?.id || device?.id;
    if (!devId) return;
    setIsExtendingAutomation(true);
    try {
      const newUntil = await extendDeviceAutomation(devId, hours);
      const label = hours >= 1 ? `${hours} giờ` : `${Math.round(hours * 60)} phút`;
      notify.success('Đã gia hạn ghi đè', `Đã cộng thêm ${label} vào thời gian ưu tiên`);
      if (device.raw) {
        device.raw.manualOverrideUntil = newUntil;
        device.raw.manualOverrideActive = true;
      }
      device.manualOverrideUntil = newUntil;
      device.manualOverrideActive = true;
      onDeviceUpdated?.({
        ...(device.raw || device),
        manualOverrideUntil: newUntil,
        manualOverrideActive: true,
      });
    } catch (err) {
      notify.error(getErrorMessage(err, 'Lỗi khi gia hạn tự động hóa'));
    } finally {
      setIsExtendingAutomation(false);
    }
  };

  useEffect(() => {
    const devId = device?.raw?.id || device?.id;
    if (!devId) return;
    let cancelled = false;

    Promise.allSettled([
      getDeviceEnergy(devId),
      getDeviceUptime(devId),
      getDeviceHistory(devId),
      getDeviceHealth(devId),
    ]).then(([energyRes, uptimeRes, historyRes, healthRes]) => {
      if (cancelled) return;
      if (energyRes.status === 'fulfilled' && energyRes.value) {
        setEnergyData(energyRes.value);
      }
      if (uptimeRes.status === 'fulfilled' && uptimeRes.value) {
        setUptimeData(uptimeRes.value);
      }
      if (historyRes.status === 'fulfilled' && historyRes.value) {
        setHistoryData(historyRes.value);
      }
      if (healthRes.status === 'fulfilled' && healthRes.value) {
        setHealthData(healthRes.value);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [device?.raw?.id, device?.id]);

  const isAc = device.type === 'Điều hòa';
  const isGate = device.type === 'Cổng';
  const isSensor = device.type === 'Cảm biến';

  const customWattage = device.raw?.settings?.wattage ?? device.settings?.wattage;
  const currentWattage = customWattage !== undefined ? Number(customWattage) : (energyData?.wattage ?? (isAc ? 750 : 40));
  const hasCustomWattage = customWattage !== undefined;

  const handleSaveWattage = async () => {
    const devId = device?.raw?.id || device?.id;
    if (!devId) return;
    const trimmed = editWattage.trim();
    const parsedWatt = parseInt(trimmed, 10);
    if (!trimmed || isNaN(parsedWatt) || parsedWatt <= 0) {
      notify.error('Vui lòng nhập công suất hợp lệ lớn hơn 0W');
      return;
    }
    setIsSavingWattage(true);
    try {
      const existingSettings = device.raw?.settings || device.settings || {};
      const updatedSettings = {
        ...existingSettings,
        wattage: parsedWatt,
      };
      const updated = await updateDeviceConfig(devId, { settings: updatedSettings });
      setIsEditingWattage(false);
      notify.success(`Đã cập nhật công suất thành ${parsedWatt}W`);

      const mergedDevice = {
        ...device,
        ...updated,
        settings: updatedSettings,
        raw: {
          ...(device.raw || {}),
          ...updated,
          settings: updatedSettings,
        },
      };
      onDeviceUpdated?.(mergedDevice);

      getDeviceEnergy(devId)
        .then((res) => res && setEnergyData(res))
        .catch(() => null);
    } catch (err) {
      console.warn('Update device wattage error:', err);
      notify.error('Lỗi khi cập nhật công suất thiết bị');
    } finally {
      setIsSavingWattage(false);
    }
  };

  // Construct real energy stats
  const energyStats: [string, string, string][] = isGate
    ? [
        ['Tổng chu kỳ', String(healthData?.switchCycles ?? 0), 'lần'],
        ['Độ bền ước tính', `${healthData?.healthPercent ?? 100}%`, ''],
        ['Tín hiệu', device.raw?.currentState?.rssi ? `${device.raw.currentState.rssi} dBm` : 'Tốt', ''],
      ]
    : isSensor
    ? [
        ['Pin / Nguồn', '100%', ''],
        ['Tín hiệu', device.raw?.currentState?.rssi ? `${device.raw.currentState.rssi} dBm` : 'Tốt', ''],
        ['Trạng thái', offline ? 'Ngoại tuyến' : 'Trực tuyến', ''],
      ]
    : [
        [
          'Tiêu thụ',
          energyData?.kwh !== undefined ? energyData.kwh.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '0',
          'kWh',
        ],
        [
          'Ước tính tiền',
          energyData?.costVnd !== undefined ? energyData.costVnd.toLocaleString('vi-VN') : '0',
          'đ',
        ],
        [
          'Công suất định mức',
          String(currentWattage),
          'W',
        ],
      ];

  // Construct real activity stats
  const activityStats: [string, string][] = isAc
    ? [
        ['Tổng thời gian', `${uptimeData?.totalHours ?? 168} giờ`],
        ['Bật', `${uptimeData?.onHours != null ? uptimeData.onHours.toFixed(1) : '0'} giờ`],
        ['Tắt', `${uptimeData?.offHours != null ? uptimeData.offHours.toFixed(1) : '0'} giờ`],
        ['Nhiệt độ hiện tại', device.raw?.currentState?.temperature ? `${device.raw.currentState.temperature}°C` : '--'],
      ]
    : isGate
    ? [
        ['Tổng chu kỳ', `${healthData?.switchCycles ?? 0} lần`],
        ['Trạng thái', device.raw?.currentState?.state === 'OPEN' ? 'Đang mở' : 'Đã đóng / Dừng'],
        ['Cảnh báo chattering', healthData?.chatteringWarning ? 'Có cảnh báo' : 'Bình thường'],
      ]
    : isSensor
    ? [
        ['Trạng thái', offline ? 'Ngoại tuyến' : 'Trực tuyến'],
        ['Giá trị đo', device.value || device.status || 'Bình thường'],
        ['Lần cập nhật cuối', device.raw?.lastSeen ? new Date(device.raw.lastSeen).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong'],
      ]
    : [
        ['Tổng thời gian', `${uptimeData?.totalHours ?? 168} giờ`],
        ['Bật', `${uptimeData?.onHours != null ? uptimeData.onHours.toFixed(1) : '0'} giờ`],
        ['Tắt', `${uptimeData?.offHours != null ? uptimeData.offHours.toFixed(1) : '0'} giờ`],
      ];

  // Map real 24-hr timeline points
  const timelineMinutes = useMemo(() => {
    if (!uptimeData?.timelinePoints || uptimeData.timelinePoints.length === 0) {
      return Array(24).fill(0);
    }
    return uptimeData.timelinePoints.map((p) =>
      p.state === 'ON' ? Math.min(60, Math.round((p.durationSeconds || 0) / 60)) : 0
    );
  }, [uptimeData]);

  // Map real events from historyData
  const events: [string, string, string][] = useMemo(() => {
    if (!historyData || historyData.length === 0) return [];
    return historyData.slice(0, 8).map((h) => {
      let icon = 'power';
      let title = 'Thay đổi trạng thái';
      const p = h.newState?.power;
      if (p === 'ON' || p === true || p === 'true') {
        icon = 'power';
        title = h.source === 'MANUAL' ? 'Bật thủ công' : 'Bật tự động';
      } else if (p === 'OFF' || p === false || p === 'false') {
        icon = 'power';
        title = h.source === 'MANUAL' ? 'Tắt thủ công' : 'Tắt tự động';
      } else if (h.newState?.mode) {
        icon = 'snowflake';
        title = `Đổi chế độ sang ${h.newState.mode}`;
      } else if (h.newState?.temperature) {
        icon = 'thermometer';
        title = `Đặt nhiệt độ ${h.newState.temperature}°C`;
      } else if (h.newState?.brightness) {
        icon = 'lamp';
        title = `Độ sáng ${h.newState.brightness}%`;
      } else if (h.newState?.state) {
        icon = 'door';
        title = `Cổng: ${h.newState.state}`;
      }
      const time = new Date(h.changedAt).toLocaleString('vi-VN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      return [icon, title, time];
    });
  }, [historyData]);

  return (
    <>
      <EnergyUsageCard
        title={
          isGate
            ? 'Tình trạng thiết bị'
            : isSensor
            ? 'Tình trạng cảm biến'
            : 'Năng lượng tiêu thụ'
        }
        stats={energyStats}
        lastSeen={offline}
        wattage={!isGate && !isSensor ? currentWattage : undefined}
        hasCustomWattage={hasCustomWattage}
        isEditingWattage={isEditingWattage}
        editWattage={editWattage}
        isSavingWattage={isSavingWattage}
        onStartEditWattage={() => {
          setEditWattage(String(currentWattage));
          setIsEditingWattage(true);
        }}
        onCancelEditWattage={() => setIsEditingWattage(false)}
        onSaveWattage={handleSaveWattage}
        onChangeEditWattage={setEditWattage}
      />
      <ActivityFrequencyCard
        initialTab="Tần suất"
        title={isSensor ? 'Sự kiện' : 'Tần suất hoạt động'}
        stats={activityStats}
        events={events}
        timelineMinutes={timelineMinutes}
        uptimePercent={uptimeData?.uptimePercent}
        lastSeen={offline}
        deviceId={device?.raw?.id || device?.id}
        deviceName={device?.name}
      />
      <SharedDeviceInfo
        device={device}
        wattage={!isGate && !isSensor ? currentWattage : undefined}
        hasCustomWattage={hasCustomWattage}
        isOverrideActive={isOverrideActive}
        formattedTime={formattedTime}
      />
      <AutomationOverrideAccordion
        deviceId={device?.raw?.id || device?.id}
        isOverrideActive={isOverrideActive}
        formattedTime={formattedTime}
        onCancelAutomation={handleCancelAutomation}
        onResumeAutomation={handleResumeAutomation}
        onExtendAutomation={handleExtendAutomation}
        isCancelling={isCancellingAutomation}
        isResuming={isResumingAutomation}
        isExtending={isExtendingAutomation}
      />
      <DeviceShadowAccordion
        shadow={shadow}
        isReconciling={isReconcilingShadow}
        isChecking={isCheckingShadow}
        onReconcile={onReconcileShadow}
        onRefresh={onRefreshShadow}
      />
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Specialized Control Sections
// ──────────────────────────────────────────────────────────────────────────

function LightDetail({
  device,
  disabled,
  onTogglePower,
  onBrightnessChange,
  onColorChange,
  onDeviceUpdated,
  shadow,
  isReconcilingShadow,
  isCheckingShadow,
  onReconcileShadow,
  onRefreshShadow,
}: {
  device: any;
  disabled: boolean;
  onTogglePower?: () => void;
  onBrightnessChange?: (brightness: number) => void;
  onColorChange?: (r: number, g: number, b: number) => void;
  onDeviceUpdated?: (updated: any) => void;
  shadow?: DeviceShadowResponse | null;
  isReconcilingShadow?: boolean;
  isCheckingShadow?: boolean;
  onReconcileShadow?: () => void;
  onRefreshShadow?: () => void;
}) {
  const [on, setOn] = useState(Boolean(device.on));
  const [level, setLevel] = useState(
    typeof device.brightness === 'number'
      ? device.brightness
      : device.currentState?.brightness
      ? Number(device.currentState.brightness)
      : 80
  );
  const [tab, setTab] = useState('Gợi ý');

  const [selectedColor, setSelectedColor] = useState(() => {
    const rawState = device.raw?.currentState || device.currentState;
    const resolved = resolveDeviceRgb(rawState);
    if (resolved) {
      return rgbToHex(resolved.r, resolved.g, resolved.b);
    }
    return lightColors[0];
  });
  const devId = device.realDeviceId || device.id;
  const storageKey = devId ? `hesta_custom_colors_${devId}` : null;

  const [savedColors, setSavedColors] = useState<CustomColorItem[]>(() => {
    const fromSettings = device.raw?.settings?.customColors || device.settings?.customColors;
    if (Array.isArray(fromSettings) && fromSettings.length > 0) {
      return fromSettings.map((item: any, idx: number) => ({
        id: item.id || `preset-${idx}`,
        name: item.name || 'Màu tùy chỉnh',
        hex: item.hex || (item.rgb ? rgbToHex(item.rgb[0], item.rgb[1], item.rgb[2]) : lightColors[0]),
        rgb: item.rgb || hexToRgb(item.hex || lightColors[0]),
      }));
    }
    if (storageKey) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.warn('Failed to parse cached custom colors:', e);
      }
    }
    return [
      { id: 'p1', name: 'Chơi game', hex: lightColors[2], rgb: hexToRgb(lightColors[2]) },
      { id: 'p2', name: 'Đêm muộn', hex: lightColors[3], rgb: hexToRgb(lightColors[3]) },
      { id: 'p3', name: 'Cà phê', hex: lightColors[0], rgb: hexToRgb(lightColors[0]) },
      { id: 'p4', name: 'Thư giãn', hex: lightColors[4], rgb: hexToRgb(lightColors[4]) },
    ];
  });

  const [colorSheet, setColorSheet] = useState<{
    mode: 'add' | 'edit';
    item?: CustomColorItem;
  } | null>(null);

  const persistCustomColors = async (newList: CustomColorItem[]) => {
    setSavedColors(newList);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newList));
      } catch (e) {
        console.warn('Failed to store custom colors locally:', e);
      }
    }
    if (devId) {
      try {
        const existingSettings = device.raw?.settings || device.settings || {};
        await updateDeviceConfig(devId, {
          name: device.name,
          settings: {
            ...existingSettings,
            customColors: newList,
          },
        });
      } catch (err) {
        console.warn('Failed to persist custom colors to backend:', err);
      }
    }
  };

  const handleSaveColor = async (name: string, hex: string, id?: string) => {
    let updated: CustomColorItem[];
    if (id) {
      updated = savedColors.map((c) => (c.id === id ? { ...c, name, hex, rgb: hexToRgb(hex) } : c));
    } else {
      const newItem: CustomColorItem = {
        id: Date.now().toString(),
        name,
        hex,
        rgb: hexToRgb(hex),
      };
      updated = [...savedColors, newItem];
    }
    await persistCustomColors(updated);
    handleApplyColor(hex);
    notify.success(`Đã lưu màu "${name}"`);
  };

  const handleDeleteColor = async (item: CustomColorItem) => {
    const updated = savedColors.filter((c) => c.id !== item.id);
    await persistCustomColors(updated);
    notify.info(`Đã xóa màu "${item.name}"`);
  };

  const colorDebounceRef = useRef<number | null>(null);
  const latestColorRef = useRef<string>(selectedColor);

  useEffect(() => {
    latestColorRef.current = selectedColor;
  }, [selectedColor]);

  useEffect(() => {
    return () => {
      if (colorDebounceRef.current) window.clearTimeout(colorDebounceRef.current);
    };
  }, []);

  const emitColorChange = useCallback((hex: string) => {
    const clean = hex.replace('#', '');
    if (clean.length === 6) {
      const num = parseInt(clean, 16);
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      if (onColorChange) {
        onColorChange(r, g, b);
      } else {
        const devId = device.realDeviceId || device.id;
        if (devId) {
          sendDeviceCommand(devId, 'SET_RGB', {
            r,
            g,
            b,
            brightness: level || 80,
          }).catch(console.warn);
        }
      }
    }
  }, [onColorChange, device, level]);

  const handlePickerChange = (newHex: string) => {
    setSelectedColor(newHex);
    latestColorRef.current = newHex;

    if (colorDebounceRef.current) {
      window.clearTimeout(colorDebounceRef.current);
    }
    colorDebounceRef.current = window.setTimeout(() => {
      emitColorChange(newHex);
    }, 60);
  };

  const handlePointerUp = () => {
    if (colorDebounceRef.current) {
      window.clearTimeout(colorDebounceRef.current);
    }
    emitColorChange(latestColorRef.current);
  };

  const handleApplyColor = (hex: string) => {
    setSelectedColor(hex);
    latestColorRef.current = hex;
    if (colorDebounceRef.current) {
      window.clearTimeout(colorDebounceRef.current);
    }
    emitColorChange(hex);
  };

  useEffect(() => {
    setOn(Boolean(device.on));
  }, [device.on]);

  const handleToggle = () => {
    const next = !on;
    setOn(next);
    onTogglePower?.();
  };

  const handleLevel = (val: number) => {
    setLevel(val);
    onBrightnessChange?.(val);
  };

  const controlsDisabled = disabled || !on;

  return (
    <>
      <LightPowerPreview
        on={on}
        level={level}
        disabled={disabled}
        color={selectedColor}
        onToggle={handleToggle}
      />
      <section
        className={`detail-section light-disableable ${
          controlsDisabled ? 'disabled' : ''
        }`}
      >
        <h3>Độ sáng</h3>
        <PillSlider
          value={level}
          onChange={handleLevel}
          disabled={controlsDisabled}
          label="Độ sáng"
        />
      </section>

      <section
        className={`detail-section light-disableable ${
          controlsDisabled ? 'disabled' : ''
        }`}
      >
        <h3>Màu sắc</h3>
        <SegmentedControl
          items={['Gợi ý', 'Tùy chỉnh']}
          value={tab}
          setValue={setTab}
          disabled={controlsDisabled}
        />
        {tab === 'Gợi ý' ? (
          <>
            <div className="light-color-swatches">
              {lightColors.map((color) => (
                <button
                  type="button"
                  disabled={controlsDisabled}
                  key={color}
                  style={{ background: color }}
                  className={selectedColor.toLowerCase() === color.toLowerCase() ? 'selected' : ''}
                  onClick={() => handleApplyColor(color)}
                >
                  {selectedColor.toLowerCase() === color.toLowerCase() && '✓'}
                </button>
              ))}
            </div>
            <div className="light-context-grid">
              {[
                'Thư giãn',
                'Đọc sách',
                'Tập trung',
                'Điện ảnh',
                'Cyberpunk',
                'Dịu êm',
              ].map((item, index) => (
                <button
                  type="button"
                  disabled={controlsDisabled}
                  key={item}
                  onClick={() => handleApplyColor(lightColors[index] || '#f5d6a0')}
                >
                  <i style={{ background: lightColors[index] }} />
                  {item}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="custom-color">
            <div
              className={`custom-color-picker-wrap ${controlsDisabled ? 'pointer-events-none opacity-50' : ''}`}
              onPointerUp={handlePointerUp}
            >
              <HexColorPicker
                color={selectedColor}
                onChange={handlePickerChange}
              />
            </div>
            <label>
              HEX{' '}
              <input
                disabled={controlsDisabled}
                value={selectedColor.toUpperCase()}
                onChange={(event) => {
                  const val = event.target.value;
                  setSelectedColor(val);
                  if (/^#?[0-9a-fA-F]{6}$/.test(val)) {
                    handleApplyColor(val.startsWith('#') ? val : `#${val}`);
                  }
                }}
              />
            </label>
            <button
              type="button"
              disabled={controlsDisabled}
              className="save-current-color"
              onClick={() => setColorSheet({ mode: 'add' })}
            >
              Lưu màu này
            </button>
          </div>
        )}
      </section>

      <SavedColors
        saved={savedColors}
        disabled={controlsDisabled}
        onApply={handleApplyColor}
        onAddClick={() => setColorSheet({ mode: 'add' })}
        onEditClick={(item) => setColorSheet({ mode: 'edit', item })}
        onDeleteClick={handleDeleteColor}
      />

      <DeviceTail
        device={device}
        offline={disabled}
        onDeviceUpdated={onDeviceUpdated}
        shadow={shadow}
        isReconcilingShadow={isReconcilingShadow}
        isCheckingShadow={isCheckingShadow}
        onReconcileShadow={onReconcileShadow}
        onRefreshShadow={onRefreshShadow}
      />

      {colorSheet && (
        <ColorCreationSheet
          currentColor={selectedColor}
          editColor={colorSheet.item}
          onClose={() => setColorSheet(null)}
          onSave={handleSaveColor}
        />
      )}
    </>
  );
}

function AcDetail({
  device,
  disabled,
  onTogglePower,
  onDeviceUpdated,
  shadow,
  isReconcilingShadow,
  isCheckingShadow,
  onReconcileShadow,
  onRefreshShadow,
}: {
  device: any;
  disabled: boolean;
  onTogglePower?: () => void;
  onDeviceUpdated?: (updated: any) => void;
  shadow?: DeviceShadowResponse | null;
  isReconcilingShadow?: boolean;
  isCheckingShadow?: boolean;
  onReconcileShadow?: () => void;
  onRefreshShadow?: () => void;
}) {
  const [on, setOn] = useState(Boolean(device.on));
  const [temp, setTemp] = useState(
    device.currentState?.temperature ? Number(device.currentState.temperature) : 24
  );
  const [mode, setMode] = useState('Lạnh');
  const [fan, setFan] = useState('Tự động');
  const [swing, setSwing] = useState(false);

  useEffect(() => {
    setOn(Boolean(device.on));
  }, [device.on]);

  const handleToggle = () => {
    const next = !on;
    setOn(next);
    onTogglePower?.();
  };

  const handleTemp = (delta: number) => {
    const next = Math.max(16, Math.min(32, temp + delta));
    setTemp(next);
    if (device.realDeviceId || device.id) {
      sendDeviceCommand(device.realDeviceId || device.id, 'SET_TEMPERATURE', {
        temperature: next,
      }).catch(console.warn);
    }
  };

  const handleMode = (m: string) => {
    setMode(m);
    if (device.realDeviceId || device.id) {
      sendDeviceCommand(device.realDeviceId || device.id, 'SET_AC_MODE', {
        mode: m,
      }).catch(console.warn);
    }
  };

  return (
    <>
      <section className={`ac-detail-hero glass-g1 ${on ? '' : 'disabled'}`}>
        <div className="detail-power">
          <span>Nguồn</span>
          <DetailToggle on={on} setOn={handleToggle} disabled={disabled} />
        </div>
        <div className="temperature-dial">
          <button
            type="button"
            disabled={!on || disabled}
            onClick={() => handleTemp(-1)}
          >
            −
          </button>
          <div>
            <strong>{temp}°C</strong>
            <small>{mode}</small>
          </div>
          <button
            type="button"
            disabled={!on || disabled}
            onClick={() => handleTemp(1)}
          >
            +
          </button>
        </div>
        {!on && <p>Điều hòa đang tắt</p>}
      </section>

      <section className="detail-section">
        <h3>Chế độ</h3>
        <SegmentedControl
          items={['Lạnh', 'Hút ẩm', 'Sưởi', 'Tự động']}
          value={mode}
          setValue={handleMode}
          disabled={!on || disabled}
        />
      </section>

      <section className="detail-section">
        <h3>Quạt</h3>
        <SegmentedControl
          items={['Tự động', 'Thấp', 'Vừa', 'Cao']}
          value={fan}
          setValue={setFan}
          disabled={!on || disabled}
        />
        <label className="swing-row">
          Đảo gió{' '}
          <DetailToggle
            on={swing}
            setOn={setSwing}
            disabled={!on || disabled}
          />
        </label>
      </section>

      <DetailAccordion title="Hẹn giờ & nâng cao">
        <div className="detail-list">
          <span>Hẹn giờ tắt (Sau 2 giờ)</span>
          <span>Chế độ ngủ đêm</span>
          <span>Chế độ tiết kiệm điện</span>
        </div>
      </DetailAccordion>

      <DeviceTail
        device={device}
        offline={disabled}
        onDeviceUpdated={onDeviceUpdated}
        shadow={shadow}
        isReconcilingShadow={isReconcilingShadow}
        isCheckingShadow={isCheckingShadow}
        onReconcileShadow={onReconcileShadow}
        onRefreshShadow={onRefreshShadow}
      />
    </>
  );
}

function GateDetail({
  device,
  disabled,
  onDeviceUpdated,
  shadow,
  isReconcilingShadow,
  isCheckingShadow,
  onReconcileShadow,
  onRefreshShadow,
}: {
  device: any;
  disabled: boolean;
  onDeviceUpdated?: (updated: any) => void;
  shadow?: DeviceShadowResponse | null;
  isReconcilingShadow?: boolean;
  isCheckingShadow?: boolean;
  onReconcileShadow?: () => void;
  onRefreshShadow?: () => void;
}) {
  const [state, setState] = useState('Dừng');

  const handleGateAction = async (item: string) => {
    setState(item);
    const action = item === 'Mở' ? 'OPEN' : item === 'Đóng' ? 'CLOSE' : 'STOP';
    if (device.realDeviceId || device.id) {
      try {
        await sendDeviceCommand(device.realDeviceId || device.id, action);
        notify.success(`Đã gửi lệnh ${item} cổng`);
      } catch (e) {
        console.warn(e);
      }
    }
  };

  return (
    <>
      <section className="gate-detail-hero glass-g1">
        <small>TRẠNG THÁI</small>
        <strong>
          {state === 'Dừng' ? 'Đã dừng' : `Đang ${state.toLowerCase()}`}
        </strong>
        <div className="position-track">
          <i />
        </div>
        <span>Vị trí 48%</span>
      </section>
      <section className="detail-section">
        <h3>Điều khiển</h3>
        <SegmentedControl
          items={['Mở', 'Dừng', 'Đóng']}
          value={state}
          setValue={handleGateAction}
          disabled={disabled}
        />
      </section>
      <DeviceTail
        device={device}
        offline={disabled}
        onDeviceUpdated={onDeviceUpdated}
        shadow={shadow}
        isReconcilingShadow={isReconcilingShadow}
        isCheckingShadow={isCheckingShadow}
        onReconcileShadow={onReconcileShadow}
        onRefreshShadow={onRefreshShadow}
      />
    </>
  );
}

function SensorDetail({
  device,
  disabled = false,
  onDeviceUpdated,
  shadow,
  isReconcilingShadow,
  isCheckingShadow,
  onReconcileShadow,
  onRefreshShadow,
}: {
  device: any;
  disabled?: boolean;
  onDeviceUpdated?: (updated: any) => void;
  shadow?: DeviceShadowResponse | null;
  isReconcilingShadow?: boolean;
  isCheckingShadow?: boolean;
  onReconcileShadow?: () => void;
  onRefreshShadow?: () => void;
}) {
  const [range, setRange] = useState('24 giờ');
  const val = device.sensor || device.value || (device.raw?.currentState?.temperature ? `${device.raw.currentState.temperature}°C` : (device.currentState?.temperature ? `${device.currentState.temperature}°C` : '--'));
  const stat = device.status || 'Bình thường';

  return (
    <>
      <section className="sensor-detail-hero">
        <strong>{val}</strong>
        <span>{stat}</span>
      </section>
      <SegmentedControl
        items={['24 giờ', '7 ngày', '30 ngày']}
        value={range}
        setValue={setRange}
      />
      <div className="detail-chart">
        <svg viewBox="0 0 340 130" preserveAspectRatio="none">
          <path className="grid" d="M0 25h340M0 65h340M0 105h340" />
          <path
            className="area"
            d="M0 100 45 88 90 94 135 55 180 70 225 38 280 50 340 22V130H0Z"
          />
          <path
            className="line"
            d="M0 100 45 88 90 94 135 55 180 70 225 38 280 50 340 22"
          />
        </svg>
      </div>
      <div className="mini-stats">
        <span>
          <small>Thấp nhất</small>
          <b>25.1°</b>
        </span>
        <span>
          <small>Trung bình</small>
          <b>26.8°</b>
        </span>
        <span>
          <small>Cao nhất</small>
          <b>28.2°</b>
        </span>
      </div>
      <DeviceTail
        device={device}
        offline={disabled}
        onDeviceUpdated={onDeviceUpdated}
        shadow={shadow}
        isReconcilingShadow={isReconcilingShadow}
        isCheckingShadow={isCheckingShadow}
        onReconcileShadow={onReconcileShadow}
        onRefreshShadow={onRefreshShadow}
      />
    </>
  );
}

function SwitchDetail({
  device,
  disabled,
  onTogglePower,
  onDeviceUpdated,
  shadow,
  isReconcilingShadow,
  isCheckingShadow,
  onReconcileShadow,
  onRefreshShadow,
}: {
  device: any;
  disabled: boolean;
  onTogglePower?: () => void;
  onDeviceUpdated?: (updated: any) => void;
  shadow?: DeviceShadowResponse | null;
  isReconcilingShadow?: boolean;
  isCheckingShadow?: boolean;
  onReconcileShadow?: () => void;
  onRefreshShadow?: () => void;
}) {
  const [on, setOn] = useState(Boolean(device.on));

  useEffect(() => {
    setOn(Boolean(device.on));
  }, [device.on]);

  const handleToggle = () => {
    const next = !on;
    setOn(next);
    onTogglePower?.();
  };

  const devName = (device.name || '').toLowerCase();
  const iconName: IconName =
    device.icon && device.icon !== 'lamp'
      ? device.icon
      : devName.includes('bơm') || devName.includes('pump')
      ? 'droplet'
      : devName.includes('quạt')
      ? 'automation'
      : devName.includes('khóa')
      ? 'lock'
      : 'automation';

  return (
    <>
      <section className="switch-detail-hero glass-g1">
        <span className="device-icon">
          <Icon name={iconName} size={34} />
        </span>
        <div>
          <strong>{on ? 'Đang bật' : 'Đang tắt'}</strong>
          <small>{device.name}</small>
        </div>
        <DetailToggle on={on} setOn={handleToggle} disabled={disabled} />
      </section>
      <DetailAccordion title="Hẹn giờ tự động">
        <p className="text-xs text-muted py-2">Chưa đặt hẹn giờ bật/tắt</p>
      </DetailAccordion>
      <DeviceTail
        device={device}
        offline={disabled}
        onDeviceUpdated={onDeviceUpdated}
        shadow={shadow}
        isReconcilingShadow={isReconcilingShadow}
        isCheckingShadow={isCheckingShadow}
        onReconcileShadow={onReconcileShadow}
        onRefreshShadow={onRefreshShadow}
      />
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Main DeviceDetail Modal Component
// ──────────────────────────────────────────────────────────────────────────

export const DeviceDetailModal: React.FC<DeviceDetailModalProps> = ({
  device,
  isOpen = true,
  onClose,
  placement = 'side',
  onDeviceUpdated,
  onDeviceRemoved,
  onTogglePower,
  onColorChange,
  onBrightnessChange,
}) => {
  if (!device || !isOpen) return null;

  const [name, setName] = useState(device.name || '');
  const [rename, setRename] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [shadow, setShadow] = useState<DeviceShadowResponse | null>(null);
  const [isReconcilingShadow, setIsReconcilingShadow] = useState(false);
  const [isCheckingShadow, setIsCheckingShadow] = useState(false);

  // Automation manual override states
  const overrideUntil = device.manualOverrideUntil || device.raw?.manualOverrideUntil;
  const { isOverrideActive, formattedTime } = useOverrideCountdown(overrideUntil);
  const [isResumingAutomation, setIsResumingAutomation] = useState(false);
  const [isCancellingAutomation, setIsCancellingAutomation] = useState(false);
  const [isExtendingAutomation, setIsExtendingAutomation] = useState(false);

  const handleResumeAutomation = async () => {
    const devId = device.raw?.id || device.id;
    if (!devId) return;
    setIsResumingAutomation(true);
    try {
      await resumeDeviceAutomation(devId);
      notify.success('Đã khôi phục tự động hóa', 'Quy tắc và kịch bản tự động sẽ tiếp tục điều khiển thiết bị');
      if (device.raw) {
        device.raw.manualOverrideUntil = null;
        device.raw.manualOverrideActive = false;
      }
      device.manualOverrideUntil = null;
      device.manualOverrideActive = false;
      onDeviceUpdated?.({
        ...(device.raw || device),
        manualOverrideUntil: null,
        manualOverrideActive: false,
      });
    } catch (err) {
      notify.error(getErrorMessage(err, 'Lỗi khi khôi phục tự động hóa'));
    } finally {
      setIsResumingAutomation(false);
    }
  };

  const handleCancelAutomation = async (minutes: number = 30) => {
    const devId = device.raw?.id || device.id;
    if (!devId) return;
    setIsCancellingAutomation(true);
    try {
      const newUntil = await cancelDeviceAutomation(devId, minutes);
      const untilStr = newUntil || new Date(Date.now() + minutes * 60 * 1000).toISOString();
      const label = minutes >= 60
        ? `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)} giờ`
        : `${minutes} phút`;
      notify.success('Đã tạm dừng tự động hóa', `Thiết bị được ưu tiên điều khiển thủ công trong ${label}`);
      if (device.raw) {
        device.raw.manualOverrideUntil = untilStr;
        device.raw.manualOverrideActive = true;
      }
      device.manualOverrideUntil = untilStr;
      device.manualOverrideActive = true;
      onDeviceUpdated?.({
        ...(device.raw || device),
        manualOverrideUntil: untilStr,
        manualOverrideActive: true,
      });
    } catch (err) {
      notify.error(getErrorMessage(err, 'Lỗi khi tạm dừng tự động hóa'));
    } finally {
      setIsCancellingAutomation(false);
    }
  };

  const handleExtendAutomation = async (hours: number = 1) => {
    const devId = device.raw?.id || device.id;
    if (!devId) return;
    setIsExtendingAutomation(true);
    try {
      const newUntil = await extendDeviceAutomation(devId, hours);
      const label = hours >= 1 ? `${hours} giờ` : `${Math.round(hours * 60)} phút`;
      notify.success('Đã gia hạn ghi đè', `Đã cộng thêm ${label} vào thời gian ưu tiên`);
      if (device.raw) {
        device.raw.manualOverrideUntil = newUntil;
        device.raw.manualOverrideActive = true;
      }
      device.manualOverrideUntil = newUntil;
      device.manualOverrideActive = true;
      onDeviceUpdated?.({
        ...(device.raw || device),
        manualOverrideUntil: newUntil,
        manualOverrideActive: true,
      });
    } catch (err) {
      notify.error(getErrorMessage(err, 'Lỗi khi gia hạn tự động hóa'));
    } finally {
      setIsExtendingAutomation(false);
    }
  };

  const fetchShadow = useCallback(async () => {
    const devId = device.raw?.id || device.id;
    if (!devId) return;
    setIsCheckingShadow(true);
    try {
      const data = await getDeviceShadow(devId);
      setShadow(data);
    } catch {
      // Thiết bị có thể chưa tạo shadow record
    } finally {
      setIsCheckingShadow(false);
    }
  }, [device.raw?.id, device.id]);

  useEffect(() => {
    void fetchShadow();
  }, [fetchShadow]);

  const handleReconcileShadow = async () => {
    const devId = device.raw?.id || device.id;
    if (!devId) return;
    setIsReconcilingShadow(true);
    try {
      const res = await reconcileDeviceShadow(devId);
      setShadow(res);
      notify.success('Đã gửi lại lệnh đồng bộ', 'Thiết bị đang cập nhật theo trạng thái mới nhất.');
    } catch {
      notify.error('Lỗi khi gửi lệnh đồng bộ lại');
    } finally {
      setIsReconcilingShadow(false);
    }
  };

  const deltaKeys = shadow ? Object.keys(shadow.deltaState || {}) : [];
  const isOutOfSync = shadow ? (!shadow.inSync || deltaKeys.length > 0) : false;

  const disabled = device.offline || device.status === 'OFFLINE';

  const devName = (device.name || '').toLowerCase();
  const devTypeStr = (device.type || device.raw?.deviceType || device.deviceType || '').toUpperCase();

  let resolvedType: FigmaDeviceType = 'Công tắc';
  if (
    devName.includes('bơm') ||
    devName.includes('pump') ||
    devTypeStr.includes('PUMP') ||
    devTypeStr.includes('WATER') ||
    devName.includes('quạt') ||
    devName.includes('ổ cắm') ||
    devName.includes('công tắc') ||
    devTypeStr.includes('SWITCH') ||
    devTypeStr.includes('RELAY') ||
    device.type === 'Công tắc'
  ) {
    resolvedType = 'Công tắc';
  } else if (
    device.type === 'Đèn' ||
    devTypeStr.includes('LIGHT') ||
    devTypeStr.includes('LED') ||
    (!device.type && devName.includes('đèn'))
  ) {
    resolvedType = 'Đèn';
  } else if (
    device.type === 'Điều hòa' ||
    devTypeStr.includes('AIR') ||
    devTypeStr.includes('CLIMATE') ||
    devTypeStr.includes('AC') ||
    devName.includes('điều hòa') ||
    devName.includes('casper')
  ) {
    resolvedType = 'Điều hòa';
  } else if (
    device.type === 'Cổng' ||
    devTypeStr.includes('GATE') ||
    devTypeStr.includes('DOOR') ||
    devName.includes('cổng')
  ) {
    resolvedType = 'Cổng';
  } else if (
    device.type === 'Cảm biến' ||
    device.sensor ||
    devTypeStr.includes('SENSOR') ||
    devTypeStr.includes('TEMP') ||
    devTypeStr.includes('HUMID') ||
    devTypeStr.includes('MOTION') ||
    devTypeStr.includes('LUX') ||
    devName.includes('cảm biến')
  ) {
    resolvedType = 'Cảm biến';
  } else if (device.type === 'Camera' || devTypeStr.includes('CAMERA') || devName.includes('camera')) {
    resolvedType = 'Camera';
  } else if (device.type) {
    resolvedType = device.type;
  } else if (device.icon === 'lamp') {
    resolvedType = 'Đèn';
  } else if (device.icon === 'snowflake') {
    resolvedType = 'Điều hòa';
  } else if (device.icon === 'door') {
    resolvedType = 'Cổng';
  } else if (device.icon === 'camera') {
    resolvedType = 'Camera';
  } else {
    resolvedType = 'Công tắc';
  }

  const handleSaveName = async () => {
    setRename(false);
    if (!name.trim() || name === device.name) return;
    try {
      if (device.id) {
        const updated = await updateDeviceConfig(device.id, { name: name.trim() });
        notify.success('Đã cập nhật tên thiết bị');
        onDeviceUpdated?.(updated);
      }
    } catch (e) {
      notify.error(getErrorMessage(e, 'Không thể đổi tên'));
      setName(device.name);
    }
  };

  const handleDeleteDevice = async () => {
    setIsDeleting(true);
    try {
      if (device.id) {
        await removeDevice(device.id);
        notify.success(`Đã xóa thiết bị ${device.name}`);
        onDeviceRemoved?.(device.id);
        setConfirm(false);
        onClose();
      }
    } catch (e) {
      notify.error(getErrorMessage(e, 'Không thể xóa thiết bị'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleCurrent = () => {
    onTogglePower?.();
  };

  const handleBrightnessCurrent = (brightness: number) => {
    onBrightnessChange?.(brightness);
  };

  const handleColorCurrent = (r: number, g: number, b: number) => {
    onColorChange?.(r, g, b);
  };

  return (
    <div className={`detail-layer ${placement === 'center' ? 'centered' : ''}`}>
      <button
        type="button"
        className="detail-scrim"
        onClick={onClose}
        aria-label="Đóng"
      />
      <aside className="detail-panel glass-g2">
        <div className="sheet-handle" />
        <header className="detail-header">
          <button
            type="button"
            className="detail-icon-button"
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </button>
          <div>
            {rename ? (
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(event) => event.key === 'Enter' && handleSaveName()}
              />
            ) : (
              <strong onClick={() => setRename(true)} title="Nhấp để sửa tên">
                {name} <small>Sửa</small>
              </strong>
            )}
            <span className={disabled ? 'offline' : ''}>
              <i />
              {disabled ? 'Ngoại tuyến' : 'Trực tuyến'} · {device.room || device.roomName || 'Nhà'}
            </span>
          </div>
          <button
            type="button"
            className="detail-icon-button"
            onClick={() => setMenu(!menu)}
            aria-label="Tùy chọn"
          >
            ⋯
          </button>
          {menu && (
            <div className="detail-menu glass-g2">
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  setRename(true);
                }}
              >
                Đổi tên thiết bị
              </button>
              {isOverrideActive ? (
                <button
                  type="button"
                  disabled={isResumingAutomation}
                  onClick={() => {
                    setMenu(false);
                    handleResumeAutomation();
                  }}
                >
                  Khôi phục tự động hóa
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isCancellingAutomation}
                  onClick={() => {
                    setMenu(false);
                    handleCancelAutomation();
                  }}
                >
                  Tạm dừng tự động (30 phút)
                </button>
              )}
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setMenu(false);
                  setConfirm(true);
                }}
              >
                Xóa thiết bị
              </button>
            </div>
          )}
        </header>

        {isOverrideActive && (
          <div className="mx-4 my-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs text-amber-700 dark:text-amber-300 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <strong className="font-bold">Đang ghi đè thủ công</strong>
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-200 font-mono font-bold text-[10px]">
                    {formattedTime}
                  </span>
                </div>
                <span className="text-[11px] opacity-90 block">
                  Ưu tiên người dùng: Các kịch bản và quy tắc tự động đang tạm dừng điều khiển thiết bị này.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={isExtendingAutomation}
                onClick={() => handleExtendAutomation(0.5)}
                className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 font-bold transition text-[11px] cursor-pointer disabled:opacity-50"
                title="Gia hạn thêm 30 phút"
              >
                +30p
              </button>
              <button
                type="button"
                disabled={isExtendingAutomation}
                onClick={() => handleExtendAutomation(1)}
                className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 font-bold transition text-[11px] cursor-pointer disabled:opacity-50"
                title="Gia hạn thêm 1 giờ"
              >
                +1h
              </button>
              <button
                type="button"
                disabled={isResumingAutomation}
                onClick={handleResumeAutomation}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition-all shadow-xs disabled:opacity-50 shrink-0 cursor-pointer text-xs"
                title="Khôi phục quyền điều khiển tự động ngay bây giờ"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isResumingAutomation ? 'animate-spin' : ''}`} />
                <span>{isResumingAutomation ? 'Đang khôi phục…' : 'Khôi phục tự động'}</span>
              </button>
            </div>
          </div>
        )}

        {disabled && (
          <div className="detail-offline">
            <span>Thiết bị hiện không phản hồi</span>
            <button type="button" onClick={() => notify.info('Đang kiểm tra kết nối thiết bị...')}>
              Thử kết nối lại
            </button>
          </div>
        )}

        {isOutOfSync && (
          <div className="mx-4 my-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs text-amber-700 dark:text-amber-300 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <strong className="block font-bold truncate">Thiết bị chưa nhận lệnh mới nhất</strong>
                <span className="text-[11px] opacity-90 block">
                  Đang chờ thiết bị phản hồi ({deltaKeys.length} trạng thái chưa đồng bộ).
                </span>
              </div>
            </div>
            <button
              type="button"
              disabled={isReconcilingShadow}
              onClick={handleReconcileShadow}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition-all shadow-xs disabled:opacity-50 shrink-0 cursor-pointer text-xs"
              title="Gửi lại lệnh để đồng bộ ngay"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isReconcilingShadow ? 'animate-spin' : ''}`} />
              <span>{isReconcilingShadow ? 'Đang gửi…' : 'Đồng bộ ngay'}</span>
            </button>
          </div>
        )}

        <div className="detail-content">
          {resolvedType === 'Đèn' ? (
            <LightDetail
              device={device}
              disabled={disabled}
              onTogglePower={handleToggleCurrent}
              onBrightnessChange={handleBrightnessCurrent}
              onColorChange={handleColorCurrent}
              onDeviceUpdated={onDeviceUpdated}
              shadow={shadow}
              isReconcilingShadow={isReconcilingShadow}
              isCheckingShadow={isCheckingShadow}
              onReconcileShadow={handleReconcileShadow}
              onRefreshShadow={fetchShadow}
            />
          ) : resolvedType === 'Điều hòa' ? (
            <AcDetail
              device={device}
              disabled={disabled}
              onTogglePower={handleToggleCurrent}
              onDeviceUpdated={onDeviceUpdated}
              shadow={shadow}
              isReconcilingShadow={isReconcilingShadow}
              isCheckingShadow={isCheckingShadow}
              onReconcileShadow={handleReconcileShadow}
              onRefreshShadow={fetchShadow}
            />
          ) : resolvedType === 'Cổng' ? (
            <GateDetail
              device={device}
              disabled={disabled}
              onDeviceUpdated={onDeviceUpdated}
              shadow={shadow}
              isReconcilingShadow={isReconcilingShadow}
              isCheckingShadow={isCheckingShadow}
              onReconcileShadow={handleReconcileShadow}
              onRefreshShadow={fetchShadow}
            />
          ) : resolvedType === 'Cảm biến' ? (
            <SensorDetail
              device={device}
              disabled={disabled}
              onDeviceUpdated={onDeviceUpdated}
              shadow={shadow}
              isReconcilingShadow={isReconcilingShadow}
              isCheckingShadow={isCheckingShadow}
              onReconcileShadow={handleReconcileShadow}
              onRefreshShadow={fetchShadow}
            />
          ) : (
            <SwitchDetail
              device={device}
              disabled={disabled}
              onTogglePower={handleToggleCurrent}
              onDeviceUpdated={onDeviceUpdated}
              shadow={shadow}
              isReconcilingShadow={isReconcilingShadow}
              isCheckingShadow={isCheckingShadow}
              onReconcileShadow={handleReconcileShadow}
              onRefreshShadow={fetchShadow}
            />
          )}
        </div>
      </aside>

      {confirm && (
        <div className="delete-dialog glass-g2">
          <strong>Xóa {name}?</strong>
          <p>Thiết bị sẽ bị xóa khỏi ngôi nhà này.</p>
          <div>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setConfirm(false)}
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={isDeleting}
              className="danger"
              onClick={handleDeleteDevice}
            >
              {isDeleting ? 'Đang xóa...' : 'Xóa thiết bị'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceDetailModal;
