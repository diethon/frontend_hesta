import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { DeviceSummary, RuleConditionInput } from '../../types/automation';
import type { DeviceGroupResponse } from '../../types/deviceGroup';
import { Icon } from '../ui/LucideIcon';
import { PickerField } from './PickerField';
import { StepperInput } from './StepperInput';
import { describeCondition } from './ruleLabels';

export interface ConditionCardProps {
  condition: RuleConditionInput & { id?: string; deviceName?: string; groupName?: string };
  index: number;
  devices: DeviceSummary[];
  groups?: DeviceGroupResponse[];
  /** Switches the condition to watch a group (any member) instead of one device. */
  onPickGroup?: () => void;
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

// Only the three comparisons non-technical users need; older rules saved with GTE/LTE/NE still display via ruleLabels.
const OPERATORS = [
  { code: 'GT', symbol: '>', label: 'Lớn hơn' },
  { code: 'LT', symbol: '<', label: 'Nhỏ hơn' },
  { code: 'EQ', symbol: '=', label: 'Bằng' },
] as const;

export function formatConditionHuman(
  cond: RuleConditionInput,
  dev?: DeviceSummary,
  groupName?: string,
): string {
  const source = cond.groupId !== undefined ? `một thiết bị trong nhóm ${groupName || '(chưa chọn)'}` : dev?.name || 'cảm biến';
  const text = describeCondition(cond.attribute, cond.operator, cond.expectedValue, source);
  return text.charAt(0).toUpperCase() + text.slice(1);
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
  groups = [],
  onPickGroup,
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

  const isGroup = condition.groupId !== undefined;
  const group = useMemo(() => groups.find((g) => g.id === condition.groupId), [groups, condition.groupId]);
  const groupName = group?.name || condition.groupName;

  // Available attributes based on sensor type
  const availableAttrs = useMemo(() => {
    if (!device) return COMMON_ATTRIBUTES;
    const type = (device.deviceType || '').toUpperCase();
    // A light, fan, plug…: "when it turns on/off" (its reported power ON/OFF).
    if (device.actionable && !device.sensor && !type.includes('SENSOR')) {
      return [{ key: 'power', label: 'Bật / tắt', unit: '', kind: 'boolean' }];
    }
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
  const isBooleanCondition = currentAttr?.kind === 'boolean' || typeof condition.expectedValue === 'boolean';

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
      className={`action-step-card glass-g1 transition-all rounded-2xl border border-[var(--border)] ${
        menuOpen ? 'relative z-30' : 'overflow-hidden'
      } ${
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
                {isGroup ? (groupName ? `Nhóm ${groupName}` : 'Chọn nhóm...') : device?.name || 'Chọn thiết bị...'}
              </strong>
              {device?.roomName && (
                <span className="shrink-0 whitespace-nowrap text-[10px] text-[var(--tertiary)] bg-[var(--solid)] px-1.5 py-0.5 rounded-md border border-[var(--border)]">
                  {device.roomName}
                </span>
              )}
            </div>
            <span className="text-[11px] text-[var(--secondary)] block truncate mt-0.5">
              {formatConditionHuman(condition, device, groupName)}
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
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                Theo dõi
              </label>
              {/* One device, or a group: true when ANY member matches. */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--muted)] border border-[var(--border)]">
                {([['device', 'Thiết bị'], ['group', 'Nhóm']] as const).map(([mode, text]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={(mode === 'group') === isGroup}
                    onClick={() => {
                      if ((mode === 'group') === isGroup) return;
                      if (mode === 'group') {
                        onChange({ ...condition, deviceId: undefined, groupId: '' });
                        onPickGroup?.();
                      } else {
                        onChange({ ...condition, groupId: undefined });
                      }
                    }}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer ${
                      (mode === 'group') === isGroup ? 'bg-[var(--solid)] text-[var(--text)] shadow-xs' : 'text-[var(--secondary)]'
                    }`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
            {isGroup ? (
              <PickerField
                label={groupName || 'Chọn nhóm'}
                caption={group ? `Đúng khi bất kỳ thiết bị nào trong ${group.deviceCount} thiết bị thỏa điều kiện` : 'Nhấn để chọn nhóm'}
                icon="grid"
                hasError={!condition.groupId}
                onClick={() => onPickGroup?.()}
              />
            ) : (
            <PickerField
              label={device ? device.name : 'Chọn thiết bị'}
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
            )}
            {!isGroup && isOffline && (
              <p className="text-[10px] text-amber-600 font-medium">
                Cảm biến đang ngoại tuyến · Quy tắc vẫn có thể lưu nhưng cần thiết bị online để hoạt động.
              </p>
            )}
          </div>

          {/* (b) Attribute Chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                Theo dõi gì
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
                        // Yes/no readings only compare by equality; > or < would never match.
                        operator: attr.kind === 'boolean' ? 'EQ' : condition.operator,
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

          {/* (c) Comparison Operators: hidden for yes/no readings, which always use EQ */}
          {!isBooleanCondition && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
              Điều kiện so sánh
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {OPERATORS.map((op) => {
                const isSelected = condition.operator === op.code;
                return (
                  <button
                    key={op.code}
                    type="button"
                    onClick={() => onChange({ ...condition, operator: op.code })}
                    className={`min-h-10 px-2 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
                      isSelected
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)] font-extrabold'
                        : 'bg-[var(--solid)] hover:bg-[var(--muted)] text-[var(--secondary)] border-[var(--border)]'
                    }`}
                    aria-pressed={isSelected}
                  >
                    <span className="text-sm leading-none opacity-70" aria-hidden="true">{op.symbol}</span>
                    <span className="leading-tight">{op.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {/* (d) Ngưỡng giá trị */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                Điều kiện
              </label>
            </div>

            {isBooleanCondition ? (
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
