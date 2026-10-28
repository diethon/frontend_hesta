import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { DeviceSummary, RuleConditionInput } from '../../types/automation';
import { Icon } from '../home/HomeIcons';
import { PickerField } from './PickerField';
import { StepperInput } from './StepperInput';

export interface ConditionCardProps {
  condition: RuleConditionInput & { id?: string; deviceName?: string };
  index: number;
  devices: DeviceSummary[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onChange: (updated: RuleConditionInput) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onPickDevice: () => void;
}

const COMMON_ATTRIBUTES = [
  { key: 'temperature', label: 'Nhiệt độ', unit: '°C', kind: 'number' },
  { key: 'humidity', label: 'Độ ẩm', unit: '%', kind: 'number' },
  { key: 'motion', label: 'Chuyển động', unit: '', kind: 'boolean' },
  { key: 'light', label: 'Ánh sáng', unit: 'lux', kind: 'number' },
  { key: 'power', label: 'Công suất', unit: 'W', kind: 'number' },
  { key: 'state', label: 'Trạng thái', unit: '', kind: 'boolean' },
];

const OPERATORS = [
  { code: 'EQ', symbol: '=', label: 'Bằng' },
  { code: 'NE', symbol: '≠', label: 'Khác' },
  { code: 'GT', symbol: '>', label: 'Lớn hơn' },
  { code: 'GTE', symbol: '≥', label: 'Lớn hơn hoặc bằng' },
  { code: 'LT', symbol: '<', label: 'Nhỏ hơn' },
  { code: 'LTE', symbol: '≤', label: 'Nhỏ hơn hoặc bằng' },
] as const;

export function formatConditionHuman(
  cond: RuleConditionInput,
  dev?: DeviceSummary
): string {
  const attrObj = COMMON_ATTRIBUTES.find(
    (a) => a.key.toLowerCase() === (cond.attribute || '').toLowerCase()
  );
  const attrName = attrObj?.label || cond.attribute || 'Chỉ số';
  const opObj = OPERATORS.find((o) => o.code === cond.operator);
  const opSymbol = opObj?.symbol || '=';

  let valStr = String(cond.expectedValue ?? '');
  if (valStr === 'true') valStr = 'Có';
  else if (valStr === 'false') valStr = 'Không';
  if (attrObj?.unit && !isNaN(Number(cond.expectedValue))) {
    valStr += attrObj.unit;
  }

  const devName = dev?.name || 'Cảm biến';
  return `${devName} · ${attrName} ${opSymbol} ${valStr}`;
}

export const ConditionCard: React.FC<ConditionCardProps> = ({
  condition,
  index: _index,
  devices,
  isExpanded,
  onToggleExpand,
  onChange,
  onDuplicate,
  onDelete,
  onPickDevice,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [customAttrOpen, setCustomAttrOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  const device = useMemo(
    () => devices.find((d) => d.id === condition.deviceId),
    [devices, condition.deviceId]
  );

  // Available attributes based on sensor type
  const availableAttrs = useMemo(() => {
    if (!device) return COMMON_ATTRIBUTES;
    const type = (device.deviceType || '').toUpperCase();
    if (type.includes('TEMP') || type.includes('DHT')) {
      return COMMON_ATTRIBUTES.filter((a) => ['temperature', 'humidity'].includes(a.key));
    }
    if (type.includes('MOTION') || type.includes('PIR')) {
      return COMMON_ATTRIBUTES.filter((a) => a.key === 'motion');
    }
    if (type.includes('LIGHT') || type.includes('LDR')) {
      return COMMON_ATTRIBUTES.filter((a) => a.key === 'light');
    }
    if (type.includes('POWER') || type.includes('ENERGY') || type.includes('SOCKET')) {
      return COMMON_ATTRIBUTES.filter((a) => ['power', 'state'].includes(a.key));
    }
    return COMMON_ATTRIBUTES;
  }, [device]);

  // Current attribute descriptor
  const currentAttr = useMemo(
    () => COMMON_ATTRIBUTES.find((a) => a.key.toLowerCase() === (condition.attribute || '').toLowerCase()),
    [condition.attribute]
  );

  // Live value from device store
  const liveValue = useMemo(() => {
    if (!device?.currentState) return null;
    const raw = device.currentState[condition.attribute];
    if (raw === undefined || raw === null) return null;
    if (typeof raw === 'boolean') return raw ? 'Có' : 'Không';
    if (typeof raw === 'number' && currentAttr?.unit) return `${raw}${currentAttr.unit}`;
    return String(raw);
  }, [device, condition.attribute, currentAttr]);

  const isOffline = device && device.status === 'OFFLINE';

  return (
    <div
      className={`action-step-card glass-g1 transition-all rounded-2xl border border-[var(--border)] overflow-hidden ${
        isExpanded ? 'ring-2 ring-[var(--accent)]/30' : ''
      }`}
    >
      {/* ── Collapsed Header ── */}
      <div
        className="action-step-collapsed p-3.5 flex items-center justify-between cursor-pointer hover:bg-[var(--muted)]/50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <div className="action-step-bubble-36 w-9 h-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
            <Icon name="activity" size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <strong className="text-xs text-[var(--text)] block truncate">
                {device?.name || 'Chọn cảm biến...'}
              </strong>
              {device?.roomName && (
                <span className="text-[10px] text-[var(--tertiary)] bg-[var(--solid)] px-1.5 py-0.5 rounded-md border border-[var(--border)]">
                  {device.roomName}
                </span>
              )}
            </div>
            <span className="text-[11px] text-[var(--secondary)] block truncate mt-0.5">
              {formatConditionHuman(condition, device)}
            </span>
          </div>
        </div>

        <div className="action-step-controls flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="w-7 h-7 rounded-lg hover:bg-[var(--border)] flex items-center justify-center text-[var(--secondary)] cursor-pointer"
            onClick={onToggleExpand}
            aria-label={isExpanded ? 'Thu gọn điều kiện' : 'Mở rộng điều kiện'}
          >
            <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} size={15} />
          </button>

          {/* ⋯ Menu */}
          <div ref={menuRef} className="relative scene-menu-wrap">
            <button
              type="button"
              className="w-7 h-7 rounded-lg hover:bg-[var(--border)] flex items-center justify-center text-[var(--secondary)] cursor-pointer"
              onClick={() => setMenuOpen((p) => !p)}
              aria-label="Tùy chọn điều kiện"
            >
              <Icon name="more" size={15} />
            </button>

            {menuOpen && (
              <div className="scene-menu glass-g2 z-20">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDuplicate?.();
                  }}
                >
                  <Icon name="copy" size={13} />
                  <span>Nhân bản điều kiện</span>
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete?.();
                  }}
                >
                  <Icon name="trash" size={13} />
                  <span>Xóa điều kiện</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Expanded Form ── */}
      {isExpanded && (
        <div className="action-step-expanded p-4 pt-1 border-t border-[var(--border)] bg-[var(--solid)]/50 space-y-4">
          {/* (a) Sensor PickerField */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
              Cảm biến nguồn
            </label>
            <PickerField
              label={device ? device.name : 'Chọn cảm biến'}
              caption={
                !device
                  ? 'Nhấn để chọn cảm biến kích hoạt'
                  : isOffline
                  ? 'Cảm biến đang ngoại tuyến'
                  : device.roomName || 'Cảm biến'
              }
              icon="activity"
              statusDot={device ? (isOffline ? 'offline' : 'online') : undefined}
              hasError={!device}
              onClick={onPickDevice}
            />
            {isOffline && (
              <p className="text-[10px] text-amber-600 font-medium">
                Cảm biến đang ngoại tuyến · Quy tắc vẫn có thể lưu nhưng cần thiết bị online để hoạt động.
              </p>
            )}
          </div>

          {/* (b) Attribute Chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                Chỉ số theo dõi
              </label>
              <button
                type="button"
                onClick={() => setCustomAttrOpen((p) => !p)}
                className="text-[11px] text-[var(--accent)] hover:underline cursor-pointer"
              >
                {customAttrOpen ? 'Ẩn chỉ số khác' : '+ Chỉ số khác'}
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {availableAttrs.map((attr) => {
                const isSelected = condition.attribute.toLowerCase() === attr.key.toLowerCase();
                return (
                  <button
                    key={attr.key}
                    type="button"
                    onClick={() => {
                      let nextExpected: unknown = condition.expectedValue;
                      if (attr.kind === 'boolean') {
                        nextExpected = true;
                      } else if (attr.kind === 'number' && typeof nextExpected !== 'number') {
                        nextExpected = attr.key === 'temperature' ? 28 : attr.key === 'humidity' ? 60 : 100;
                      }
                      onChange({
                        ...condition,
                        attribute: attr.key,
                        expectedValue: nextExpected,
                      });
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                        : 'bg-[var(--solid)] hover:bg-[var(--muted)] text-[var(--text)] border-[var(--border)]'
                    }`}
                  >
                    {attr.label}
                  </button>
                );
              })}
            </div>

            {customAttrOpen && (
              <input
                type="text"
                placeholder="Nhập tên thuộc tính tùy chỉnh (vd: co2, aqi)..."
                value={condition.attribute}
                onChange={(e) =>
                  onChange({
                    ...condition,
                    attribute: e.target.value,
                  })
                }
                className="w-full mt-2 px-3 py-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--solid)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            )}
          </div>

          {/* (c) Comparison Operators */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
              Điều kiện so sánh
            </label>
            <div className="grid grid-cols-6 gap-1">
              {OPERATORS.map((op) => {
                const isSelected = condition.operator === op.code;
                return (
                  <button
                    key={op.code}
                    type="button"
                    onClick={() => onChange({ ...condition, operator: op.code })}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      isSelected
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)] font-extrabold'
                        : 'bg-[var(--solid)] hover:bg-[var(--muted)] text-[var(--secondary)] border-[var(--border)]'
                    }`}
                    title={op.label}
                  >
                    <span className="text-sm leading-none">{op.symbol}</span>
                    <span className="text-[9px] font-medium leading-none opacity-80">{op.code}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* (d) Ngưỡng giá trị */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                Ngưỡng kích hoạt
              </label>
              {liveValue && (
                <span className="text-[11px] text-[var(--tertiary)] italic">
                  Hiện tại: <strong className="text-[var(--text)] not-italic font-semibold">{liveValue}</strong>
                </span>
              )}
            </div>

            {currentAttr?.kind === 'boolean' || typeof condition.expectedValue === 'boolean' ? (
              <div className="grid grid-cols-2 gap-2 bg-[var(--solid)] p-1 rounded-2xl border border-[var(--border)]">
                {[
                  { value: true, label: condition.attribute === 'motion' ? 'Có chuyển động' : 'Bật (ON)' },
                  { value: false, label: condition.attribute === 'motion' ? 'Không có' : 'Tắt (OFF)' },
                ].map((item) => {
                  const isChecked = condition.expectedValue === item.value || String(condition.expectedValue) === String(item.value);
                  return (
                    <button
                      key={String(item.value)}
                      type="button"
                      onClick={() => onChange({ ...condition, expectedValue: item.value })}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-[var(--accent)] text-white shadow-xs'
                          : 'text-[var(--secondary)] hover:text-[var(--text)]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <StepperInput
                value={Number(condition.expectedValue) || 0}
                unit={currentAttr?.unit}
                onChange={(num) => onChange({ ...condition, expectedValue: num })}
                liveValue={liveValue || undefined}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
