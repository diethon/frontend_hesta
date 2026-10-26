import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Icon, type IconName } from '../home/HomeIcons';
import type { DeviceResponse } from '../../types/device';
import {
  sendDeviceCommand,
  updateDeviceConfig,
  removeDevice,
} from '../../services/deviceApi';
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
              <Icon name="lamp" size={34} />
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
}: {
  device: any;
  expanded?: boolean;
}) {
  const [toast, setToast] = useState(false);
  const copy = (val: string) => {
    navigator.clipboard?.writeText(val);
    setToast(true);
    window.setTimeout(() => setToast(false), 1400);
  };

  const deviceTypeStr = device.type || device.deviceType || 'Thiết bị';
  const roomName = device.room || device.roomName || 'Chưa gán phòng';

  const rows: [string, string][] = [
    ['Loại', deviceTypeStr],
    ['Phòng', roomName],
    ['Thương hiệu', device.brand || 'HESTA'],
    ['Model', device.model || 'HST-IOT-2026'],
    ['Số serial', device.serialNumber || device.realDeviceId || 'HST24A8F31C'],
    ['Địa chỉ MAC', device.macAddress || 'A4:CF:12:8B:3E:91'],
    ['Địa chỉ IP', device.ipAddress || '192.168.1.45'],
    ['Kết nối', 'Wi-Fi 2.4 GHz'],
    ['Tín hiệu', 'Tốt · -52 dBm'],
    ['Firmware', device.firmwareVersion || '2.4.1 · Mới nhất'],
    ['Cập nhật lần cuối', 'Vừa xong'],
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
  stats = [
    ['Tiêu thụ', '13,74', 'kWh'],
    ['Ước tính tiền', '28.084', 'đ'],
    ['Công suất TB', '40', 'W'],
  ],
  lastSeen,
}: {
  _state?: string | null;
  title?: string;
  stats?: string[][];
  lastSeen?: boolean;
}) {
  const [range, setRange] = useState('30 ngày');
  const bars = [32, 48, 40, 72, 55, 82, 62, 45, 68, 51];
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
      {lastSeen && <p className="data-until">Dữ liệu đến 08:42</p>}
      <div className="energy-stats">
        {stats.map(([label, value, unit]) => (
          <span key={label}>
            <small>{label}</small>
            <strong>
              {value} <i>{unit}</i>
            </strong>
          </span>
        ))}
      </div>
      <div className="light-bar-chart">
        {bars.map((height, index) => (
          <button
            type="button"
            key={index}
            title={`${(height / 20).toFixed(1)} kWh`}
            className={height === 82 ? 'peak' : ''}
          >
            <i style={{ height: `${height}%` }} />
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
  stats = [
    ['Tổng thời gian', '168 giờ'],
    ['Bật', '112,49 giờ'],
    ['Tắt', '55,51 giờ'],
  ],
  events,
  lastSeen,
}: {
  _state?: string | null;
  initialTab?: string;
  title?: string;
  stats?: string[][];
  events?: string[][];
  lastSeen?: boolean;
}) {
  const [tab, setTab] = useState(initialTab);
  const minutes = [
    0, 8, 14, 22, 0, 12, 34, 38, 42, 51, 48, 30, 27, 40, 56, 52, 45, 39, 25, 18,
    31, 46, 20, 5,
  ];
  return (
    <section className="light-metric-card glass-g1">
      <header>
        <div>
          <strong>{title}</strong>
          <small>7 ngày qua</small>
        </div>
        <span className="usage-chip">67%</span>
      </header>
      <SegmentedControl
        items={['Tần suất', 'Lịch sử']}
        value={tab}
        setValue={setTab}
      />
      {lastSeen && <p className="data-until">Dữ liệu đến 08:42</p>}
      {tab === 'Tần suất' ? (
        <>
          <div className={`usage-stats ${stats.length === 4 ? 'four' : ''}`}>
            {stats.map(([label, value]) => (
              <span key={label}>
                <small>{label}</small>
                <b>{value}</b>
              </span>
            ))}
          </div>
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
        <div className="light-history">
          {(
            events ?? [
              ['power', 'Bật bởi Minh', 'Hôm nay · 07:19'],
              ['moon', 'Tắt theo kịch bản Ngủ ngon', 'Hôm qua · 23:02'],
              ['film', 'Đổi màu sang Điện ảnh', 'Hôm qua · 20:14'],
              ['power', 'Bật bởi Minh', 'Thứ hai · 18:30'],
              ['sparkles', 'Áp dụng cảnh Thư giãn', 'Chủ nhật · 19:10'],
            ]
          ).map(([icon, text, time]) => (
            <div key={text}>
              <span>
                <Icon name={icon as IconName} size={17} />
              </span>
              <strong>{text}</strong>
              <small>{time}</small>
            </div>
          ))}
          <button type="button">Xem tất cả</button>
        </div>
      )}
    </section>
  );
}

function DeviceTail({
  device,
  offline,
}: {
  device: any;
  offline: boolean;
}) {
  const isAc = device.type === 'Điều hòa';
  const isGate = device.type === 'Cổng';
  const isSensor = device.type === 'Cảm biến';
  const isPump = (device.name || '').toLowerCase().includes('bơm');

  const energyStats = isAc
    ? [
        ['Tiêu thụ', '84,2', 'kWh'],
        ['Ước tính tiền', '176.820', 'đ'],
        ['Công suất TB', '780', 'W'],
      ]
    : isGate
    ? [
        ['Số lần mở hôm nay', '6', ''],
        ['Tổng chu kỳ', '1.248', ''],
        ['Tín hiệu', 'Tốt', ''],
      ]
    : isSensor
    ? [
        ['Pin', '87', '%'],
        ['Tín hiệu', 'Tốt', ''],
        ['Báo cáo mỗi', '30', 'giây'],
      ]
    : [
        ['Tiêu thụ', isPump ? '8,4' : '2,8', 'kWh'],
        ['Ước tính tiền', isPump ? '17.640' : '5.880', 'đ'],
        ['Công suất TB', isPump ? '750' : '40', 'W'],
      ];

  const activityStats = isAc
    ? [
        ['Tổng thời gian', '168 giờ'],
        ['Bật', '98 giờ'],
        ['Tắt', '70 giờ'],
        ['Nhiệt độ đặt TB', '25°C'],
      ]
    : isGate
    ? [
        ['Mở', '23 lần'],
        ['Đóng', '23 lần'],
        ['Dừng', '2 lần'],
      ]
    : isSensor
    ? [
        ['Sự kiện', '18'],
        ['Cảnh báo', '2'],
        ['Bình thường', '16'],
      ]
    : [
        ['Tổng thời gian', '168 giờ'],
        ['Bật', '42 giờ'],
        ['Tắt', '126 giờ'],
      ];

  const events = isAc
    ? [
        ['power', 'Bật bởi Minh · 23°C', 'Hôm nay · 07:19'],
        ['droplet', 'Đổi chế độ sang Hút ẩm', 'Hôm qua · 20:12'],
        ['moon', 'Tắt theo kịch bản Ngủ ngon', 'Hôm qua · 23:02'],
      ]
    : isGate
    ? [
        ['door', 'Mở bởi Minh', 'Hôm nay · 08:42'],
        ['door', 'Đóng theo kịch bản Ra khỏi nhà', 'Hôm qua · 07:30'],
      ]
    : isSensor
    ? [
        ['activity', 'Phát hiện chuyển động', 'Hôm nay · 08:42'],
        ['droplet', 'Độ ẩm vượt 70%', 'Hôm qua · 21:10'],
        ['moon', 'Trời tối', 'Hôm qua · 18:32'],
      ]
    : undefined;

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
      />
      <ActivityFrequencyCard
        initialTab="Tần suất"
        title={isSensor ? 'Sự kiện' : 'Tần suất hoạt động'}
        stats={activityStats}
        events={events}
        lastSeen={offline}
      />
      <SharedDeviceInfo device={device} />
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
}: {
  device: any;
  disabled: boolean;
  onTogglePower?: () => void;
  onBrightnessChange?: (brightness: number) => void;
  onColorChange?: (r: number, g: number, b: number) => void;
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

      <DeviceTail device={device} offline={disabled} />

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
}: {
  device: any;
  disabled: boolean;
  onTogglePower?: () => void;
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
          <span>Chế độ ngủ (Sleep Mode)</span>
          <span>Tiết kiệm điện (Eco Inverter)</span>
        </div>
      </DetailAccordion>

      <DeviceTail device={device} offline={disabled} />
    </>
  );
}

function GateDetail({
  device,
  disabled,
}: {
  device: any;
  disabled: boolean;
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
      <DeviceTail device={device} offline={disabled} />
    </>
  );
}

function SensorDetail({
  device,
  disabled = false,
}: {
  device: any;
  disabled?: boolean;
}) {
  const [range, setRange] = useState('24 giờ');
  const val = device.sensor || device.value || (device.currentState?.temperature ? `${device.currentState.temperature}°C` : '27.7°C');
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
      <DeviceTail device={device} offline={disabled} />
    </>
  );
}

function SwitchDetail({
  device,
  disabled,
  onTogglePower,
}: {
  device: any;
  disabled: boolean;
  onTogglePower?: () => void;
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
      <DeviceTail device={device} offline={disabled} />
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

        {disabled && (
          <div className="detail-offline">
            <span>Thiết bị hiện không phản hồi</span>
            <button type="button" onClick={() => notify.info('Đang kiểm tra kết nối thiết bị...')}>
              Thử kết nối lại
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
            />
          ) : resolvedType === 'Điều hòa' ? (
            <AcDetail
              device={device}
              disabled={disabled}
              onTogglePower={handleToggleCurrent}
            />
          ) : resolvedType === 'Cổng' ? (
            <GateDetail device={device} disabled={disabled} />
          ) : resolvedType === 'Cảm biến' ? (
            <SensorDetail device={device} disabled={disabled} />
          ) : (
            <SwitchDetail
              device={device}
              disabled={disabled}
              onTogglePower={handleToggleCurrent}
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
