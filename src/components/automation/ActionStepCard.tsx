import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AUTO_OFF_KEY, DELAY_ACTION, MAX_AUTO_OFF_SECONDS, MAX_DELAY_SECONDS } from '../../types/automation';
import type { DeviceSummary, RuleActionInput } from '../../types/automation';
import type { SceneResponse } from '../../types/scene';
import type { DeviceGroupResponse } from '../../types/deviceGroup';
import { autoOffVerb, formatDuration } from './ruleTiming';
import { DurationInput } from './DurationInput';
import { Icon, type IconName } from '../ui/LucideIcon';
import { PickerField } from './PickerField';
import { StepperInput } from './StepperInput';
import { getDeviceActions, type ActionOption } from '../deviceActionOptions';
import { getFigmaIconForDevice, getFigmaIconForScene } from '../scene/ScenePage';

export interface ActionStepCardProps {
  action: RuleActionInput & { id?: string; deviceName?: string; sceneName?: string; groupName?: string };
  index: number;
  totalCount: number;
  devices: DeviceSummary[];
  scenes: SceneResponse[];
  groups?: DeviceGroupResponse[];
  onPickGroup?: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onChange: (updated: RuleActionInput) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onPickDevice: () => void;
  onPickScene: () => void;
}

const COLOR_SWATCHES = [
  '#ff4d4f', '#faad14', '#52c41a', '#1890ff', '#722ed1', '#eb2f96', '#ffffff'
];

export function formatActionSummaryHuman(
  act: RuleActionInput,
  device?: DeviceSummary,
  scene?: SceneResponse,
  groupName?: string,
): string {
  if (act.action === DELAY_ACTION) return `Chờ ${formatDuration(Number(act.parameters?.seconds) || 0)}`;
  const text = formatCommand(act, device, scene, groupName);
  const autoOff = Number(act.parameters?.[AUTO_OFF_KEY]) || 0;
  const verb = autoOffVerb(act.action, act.parameters);
  return autoOff > 0 && verb ? `${text}, ${verb.toLowerCase()} sau ${formatDuration(autoOff)}` : text;
}

function formatCommand(act: RuleActionInput, device?: DeviceSummary, scene?: SceneResponse, groupName?: string): string {
  if (act.action === 'EXECUTE_SCENE') {
    return scene ? `Chạy kịch bản: ${scene.name}` : 'Chạy kịch bản (chưa chọn)';
  }

  const devName = act.groupId !== undefined ? `nhóm ${groupName || '(chưa chọn)'}` : device?.name || 'thiết bị';
  const code = act.action;
  if (code === 'TURN_ON') return `Bật ${devName}`;
  if (code === 'TURN_OFF') return `Tắt ${devName}`;
  if (code === 'TOGGLE') return `Đảo trạng thái bật/tắt ${devName}`;
  if (code === 'OPEN') return `Mở cổng/cửa ${devName}`;
  if (code === 'CLOSE') return `Đóng cổng/cửa ${devName}`;
  if (code === 'STOP') return `Dừng cổng/cửa ${devName}`;
  if (code === 'SET_BRIGHTNESS') {
    const level = act.parameters?.level ?? act.parameters?.brightness ?? 50;
    return `Đặt độ sáng ${devName} thành ${level}%`;
  }
  if (code === 'SET_RGB' || code === 'SET_COLOR') {
    const col = String(act.parameters?.color || act.parameters?.hex || '#ffc107');
    return `Đổi màu ${devName} (${col})`;
  }
  if (code === 'SET_TEMPERATURE') {
    const temp = act.parameters?.temperature ?? 26;
    return `Đặt nhiệt độ ${devName} thành ${temp}°C`;
  }
  if (code === 'SET_SPEED') {
    const spd = act.parameters?.speed ?? 50;
    return `Đặt tốc độ ${devName} thành ${spd}%`;
  }
  if (code === 'SET_STATE') {
    return `Đặt trạng thái tùy chỉnh ${devName}`;
  }
  return `${code} ${devName}`;
}

export const ActionStepCard: React.FC<ActionStepCardProps> = ({
  action,
  index,
  totalCount,
  devices,
  scenes,
  isExpanded,
  onToggleExpand,
  onChange,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onPickDevice,
  onPickScene,
  groups = [],
  onPickGroup,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [jsonAccordionOpen, setJsonAccordionOpen] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
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

  const isSceneStep = action.action === 'EXECUTE_SCENE';
  const isDelayStep = action.action === DELAY_ACTION;
  // A group step is created with groupId '' until a group is picked.
  const isGroupStep = action.groupId !== undefined;
  const group = useMemo(() => groups.find((g) => g.id === action.groupId), [groups, action.groupId]);
  const groupName = group?.name || action.groupName;

  const device = useMemo(
    () => (action.deviceId ? devices.find((d) => d.id === action.deviceId) : undefined),
    [devices, action.deviceId]
  );

  const scene = useMemo(
    () => (action.sceneId ? scenes.find((s) => s.id === action.sceneId) : undefined),
    [scenes, action.sceneId]
  );

  const iconName: IconName = useMemo(() => {
    if (isDelayStep) return 'clock';
    if (isGroupStep) return 'grid';
    if (isSceneStep) return scene ? getFigmaIconForScene(scene.name, scene.icon) : 'sparkles';
    return device ? getFigmaIconForDevice(device.deviceType, device.name) : 'power';
  }, [isSceneStep, isDelayStep, isGroupStep, scene, device]);

  const deviceActions: ActionOption[] = useMemo(() => {
    if (isGroupStep) {
      // Every command any member supports; members that cannot do it are skipped when the rule runs.
      const seen = new Map<string, ActionOption>();
      devices.filter((d) => group?.deviceIds.includes(d.id))
        .forEach((d) => getDeviceActions(d).forEach((opt) => seen.has(opt.code) || seen.set(opt.code, opt)));
      return [...seen.values()];
    }
    if (!device) return [];
    return getDeviceActions(device);
  }, [device, devices, group, isGroupStep]);
  const autoOffSeconds = Number(action.parameters?.[AUTO_OFF_KEY]) || 0;
  const undoVerb = autoOffVerb(action.action, action.parameters);

  const isOffline = device && device.status === 'OFFLINE';

  const handleActionCodeChange = (code: string) => {
    const opt = deviceActions.find((a) => a.code === code);
    let nextParams: Record<string, unknown> = {};

    if (code === 'SET_BRIGHTNESS') {
      nextParams = { level: 50 };
    } else if (code === 'SET_RGB' || code === 'SET_COLOR') {
      nextParams = { color: '#ffc107', hex: '#ffc107', r: 255, g: 193, b: 7 };
    } else if (code === 'SET_TEMPERATURE') {
      nextParams = { temperature: 26 };
    } else if (code === 'SET_SPEED') {
      nextParams = { speed: 50 };
    } else if (code === 'SET_STATE') {
      nextParams = { state: 'ON' };
    } else if (opt && opt.parameterKey && opt.defaultValue) {
      nextParams = { [opt.parameterKey]: opt.defaultValue };
    }

    onChange({
      ...action,
      action: code,
      parameters: nextParams,
    });
  };

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
          <div className="action-step-bubble-36 w-9 h-9 rounded-xl bg-[var(--solid)] text-[var(--accent)] border border-[var(--border)] flex items-center justify-center shrink-0">
            <Icon name={iconName} size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[var(--tertiary)] bg-[var(--muted)] px-1.5 py-0.5 rounded-md">
                {index + 1}
              </span>
              <strong className="text-xs text-[var(--text)] block truncate">
                {isDelayStep
                  ? 'Chờ'
                  : isGroupStep
                  ? groupName ? `Nhóm ${groupName}` : 'Chọn nhóm...'
                  : isSceneStep
                  ? scene?.name || 'Chọn kịch bản...'
                  : device?.name || 'Chọn thiết bị...'}
              </strong>
            </div>
            <span className="text-[11px] text-[var(--secondary)] block truncate mt-0.5">
              {formatActionSummaryHuman(action, device, scene, groupName)}
            </span>
          </div>
        </div>

        <div className="action-step-controls flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="w-7 h-7 rounded-lg hover:bg-[var(--border)] flex items-center justify-center text-[var(--secondary)] cursor-pointer"
            onClick={onToggleExpand}
            aria-label={isExpanded ? 'Thu gọn hành động' : 'Mở rộng hành động'}
          >
            <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} size={15} />
          </button>

          {/* ⋯ Menu */}
          <div ref={menuRef} className="relative scene-menu-wrap">
            <button
              type="button"
              className="w-7 h-7 rounded-lg hover:bg-[var(--border)] flex items-center justify-center text-[var(--secondary)] cursor-pointer"
              onClick={() => setMenuOpen((p) => !p)}
              aria-label="Tùy chọn hành động"
            >
              <Icon name="more" size={15} />
            </button>

            {menuOpen && (
              <div className="scene-menu glass-g2 z-20">
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onMoveUp?.();
                    }}
                  >
                    <Icon name="arrowUp" size={13} />
                    <span>Di chuyển lên</span>
                  </button>
                )}
                {index < totalCount - 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onMoveDown?.();
                    }}
                  >
                    <Icon name="arrowDown" size={13} />
                    <span>Di chuyển xuống</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDuplicate?.();
                  }}
                >
                  <Icon name="copy" size={13} />
                  <span>Nhân bản hành động</span>
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
                  <span>Xóa hành động</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Expanded Form ── */}
      {isExpanded && (
        <div className="action-step-expanded p-4 pt-1 border-t border-[var(--border)] bg-[var(--solid)]/50 space-y-4">
          {/* Target Device / Scene / Group Picker, or the wait time */}
          {isDelayStep ? (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                Chờ bao lâu rồi làm bước tiếp theo
              </label>
              <DurationInput
                label="Thời gian chờ"
                seconds={Number(action.parameters?.seconds) || 30}
                max={MAX_DELAY_SECONDS}
                onChange={(seconds) => onChange({ ...action, parameters: { seconds } })}
              />
            </div>
          ) : isGroupStep ? (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                Nhóm thiết bị
              </label>
              <PickerField
                label={groupName || 'Chọn nhóm'}
                caption={group ? `${group.deviceCount} thiết bị · thiết bị không hỗ trợ lệnh sẽ được bỏ qua` : 'Nhấn để chọn nhóm'}
                icon="grid"
                hasError={!action.groupId}
                onClick={() => onPickGroup?.()}
              />
            </div>
          ) : isSceneStep ? (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                Kịch bản thực thi
              </label>
              <PickerField
                label={scene ? scene.name : 'Chọn kịch bản'}
                caption={scene ? `${scene.actions?.length || 0} hành động` : 'Nhấn để chọn kịch bản'}
                icon="sparkles"
                hasError={!scene}
                onClick={onPickScene}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                Thiết bị điều khiển
              </label>
              <PickerField
                label={device ? device.name : 'Chọn thiết bị'}
                caption={
                  !device
                    ? 'Nhấn để chọn thiết bị thực thi'
                    : isOffline
                    ? 'Thiết bị đang ngoại tuyến'
                    : device.roomName || 'Thiết bị'
                }
                icon={iconName}
                statusDot={device ? (isOffline ? 'offline' : 'online') : undefined}
                hasError={!device}
                onClick={onPickDevice}
              />
              {isOffline && (
                <p className="text-[10px] text-amber-600 font-medium">
                  Thiết bị đang ngoại tuyến · Hành động có thể không thực hiện được cho đến khi online.
                </p>
              )}
            </div>
          )}

          {/* Device Command Chips */}
          {!isSceneStep && !isDelayStep && (device || group) && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                Lệnh điều khiển
              </label>
              <div className="command-chips-row">
                {deviceActions.map((opt) => {
                  const isSelected = action.action === opt.code;
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => handleActionCodeChange(opt.code)}
                      className={`command-chip ${isSelected ? 'active' : ''}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Auto-off: undo a turn-on / open after a while */}
          {!isSceneStep && !isDelayStep && undoVerb && (
            <div className="space-y-2 p-3 rounded-2xl bg-[var(--solid)] border border-[var(--border)]">
              <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoOffSeconds > 0}
                  onChange={(e) => {
                    const next = { ...action.parameters };
                    if (e.target.checked) next[AUTO_OFF_KEY] = 300;
                    else delete next[AUTO_OFF_KEY];
                    onChange({ ...action, parameters: next });
                  }}
                  className="accent-[var(--accent)]"
                />
                {undoVerb} sau một khoảng thời gian
              </label>
              {autoOffSeconds > 0 && (
                <DurationInput
                  label={`${undoVerb} sau`}
                  seconds={autoOffSeconds}
                  max={MAX_AUTO_OFF_SECONDS}
                  onChange={(seconds) => onChange({ ...action, parameters: { ...action.parameters, [AUTO_OFF_KEY]: seconds } })}
                />
              )}
            </div>
          )}

          {/* Gate Command Specific Buttons */}
          {!isSceneStep && (action.action === 'OPEN' || action.action === 'CLOSE' || action.action === 'STOP') && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                Trạng thái cổng
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { code: 'OPEN', label: 'Mở (OPEN)', color: 'bg-emerald-600' },
                  { code: 'STOP', label: 'Dừng (STOP)', color: 'bg-amber-600' },
                  { code: 'CLOSE', label: 'Đóng (CLOSE)', color: 'bg-rose-600' },
                ].map((g) => {
                  const isSelected = action.action === g.code;
                  return (
                    <button
                      key={g.code}
                      type="button"
                      onClick={() => onChange({ ...action, action: g.code, parameters: {} })}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        isSelected
                          ? `${g.color} text-white border-transparent shadow-xs`
                          : 'bg-[var(--solid)] hover:bg-[var(--muted)] text-[var(--text)] border-[var(--border)]'
                      }`}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Brightness Slider */}
          {!isSceneStep && action.action === 'SET_BRIGHTNESS' && (
            <div className="space-y-2 p-3 rounded-2xl bg-[var(--solid)] border border-[var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text)]">Độ sáng</span>
                <span className="text-xs font-bold text-[var(--accent)]">
                  {Number(action.parameters?.level ?? 50)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Number(action.parameters?.level ?? 50)}
                onChange={(e) =>
                  onChange({
                    ...action,
                    parameters: { ...action.parameters, level: Number(e.target.value) },
                  })
                }
                className="w-full accent-[var(--accent)] cursor-pointer"
              />
            </div>
          )}

          {/* RGB Color Swatches */}
          {!isSceneStep && (action.action === 'SET_RGB' || action.action === 'SET_COLOR') && (
            <div className="space-y-2 p-3 rounded-2xl bg-[var(--solid)] border border-[var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text)]">Màu sắc</span>
                <span className="text-xs font-mono text-[var(--secondary)]">
                  {String(action.parameters?.color || action.parameters?.hex || '#ffc107')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {COLOR_SWATCHES.map((hex) => {
                  const isSelected =
                    String(action.parameters?.color || action.parameters?.hex).toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...action,
                          parameters: { ...action.parameters, color: hex, hex },
                        })
                      }
                      style={{ backgroundColor: hex }}
                      className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                        isSelected ? 'scale-115 border-[var(--accent)] shadow-md' : 'border-white/80'
                      }`}
                      aria-label={`Màu ${hex}`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* AC Temperature */}
          {!isSceneStep && action.action === 'SET_TEMPERATURE' && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                Nhiệt độ điều hòa (°C)
              </label>
              <StepperInput
                value={Number(action.parameters?.temperature ?? 26)}
                min={16}
                max={30}
                step={1}
                unit="°C"
                onChange={(val) =>
                  onChange({
                    ...action,
                    parameters: { ...action.parameters, temperature: val },
                  })
                }
              />
            </div>
          )}

          {/* Speed Stepper */}
          {!isSceneStep && action.action === 'SET_SPEED' && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                Tốc độ (%)
              </label>
              <StepperInput
                value={Number(action.parameters?.speed ?? 50)}
                min={1}
                max={100}
                step={5}
                unit="%"
                onChange={(val) =>
                  onChange({
                    ...action,
                    parameters: { ...action.parameters, speed: val },
                  })
                }
              />
            </div>
          )}

          {/* Raw JSON only where no form exists (SET_STATE); hidden otherwise to keep the card non-technical. */}
          {action.action === 'SET_STATE' && (
            <div className="pt-1 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setJsonAccordionOpen((p) => !p)}
                className="w-full flex items-center justify-between text-left py-1 text-[11px] font-semibold text-[var(--tertiary)] hover:text-[var(--text)] transition-colors cursor-pointer"
              >
                <span>Cài đặt nâng cao</span>
                <Icon name={jsonAccordionOpen ? 'chevronUp' : 'chevronDown'} size={14} />
              </button>

              {jsonAccordionOpen && (
                <div className="pt-2 space-y-1">
                  <textarea
                    rows={3}
                    defaultValue={JSON.stringify(action.parameters || {}, null, 2)}
                    onBlur={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setJsonError(null);
                        onChange({ ...action, parameters: parsed });
                      } catch {
                        setJsonError('JSON không hợp lệ');
                      }
                    }}
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--solid)] text-xs font-mono text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                  {jsonError && <p className="text-[10px] text-rose-500 font-semibold">{jsonError}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
