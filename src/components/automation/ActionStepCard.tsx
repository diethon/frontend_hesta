import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { DeviceSummary, RuleActionInput } from '../../types/automation';
import type { SceneResponse } from '../../types/scene';
import { Icon, type IconName } from '../home/HomeIcons';
import { PickerField } from './PickerField';
import { StepperInput } from './StepperInput';
import { getDeviceActions, type ActionOption } from '../deviceActionOptions';
import { getFigmaIconForDevice, getFigmaIconForScene } from '../scene/ScenePage';

export interface ActionStepCardProps {
  action: RuleActionInput & { id?: string; deviceName?: string; sceneName?: string };
  index: number;
  totalCount: number;
  devices: DeviceSummary[];
  scenes: SceneResponse[];
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
  scene?: SceneResponse
): string {
  if (act.action === 'EXECUTE_SCENE') {
    return scene ? `Chạy kịch bản: ${scene.name}` : 'Chạy kịch bản (chưa chọn)';
  }

  const devName = device?.name || 'Thiết bị';
  const code = act.action;
  if (code === 'TURN_ON') return `Bật ${devName}`;
  if (code === 'TURN_OFF') return `Tắt ${devName}`;
  if (code === 'TOGGLE') return `Đảo trạng thái (Bật/Tắt) ${devName}`;
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

  const device = useMemo(
    () => (action.deviceId ? devices.find((d) => d.id === action.deviceId) : undefined),
    [devices, action.deviceId]
  );

  const scene = useMemo(
    () => (action.sceneId ? scenes.find((s) => s.id === action.sceneId) : undefined),
    [scenes, action.sceneId]
  );

  const iconName: IconName = useMemo(() => {
    if (isSceneStep) return scene ? getFigmaIconForScene(scene.name, scene.icon) : 'sparkles';
    return device ? getFigmaIconForDevice(device.deviceType, device.name) : 'power';
  }, [isSceneStep, scene, device]);

  const deviceActions: ActionOption[] = useMemo(() => {
    if (!device) return [];
    return getDeviceActions(device);
  }, [device]);

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
          <div className="action-step-bubble-36 w-9 h-9 rounded-xl bg-[var(--solid)] text-[var(--accent)] border border-[var(--border)] flex items-center justify-center shrink-0">
            <Icon name={iconName} size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[var(--tertiary)] bg-[var(--muted)] px-1.5 py-0.5 rounded-md">
                {index + 1}
              </span>
              <strong className="text-xs text-[var(--text)] block truncate">
                {isSceneStep
                  ? scene?.name || 'Chọn kịch bản...'
                  : device?.name || 'Chọn thiết bị...'}
              </strong>
            </div>
            <span className="text-[11px] text-[var(--secondary)] block truncate mt-0.5">
              {formatActionSummaryHuman(action, device, scene)}
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
          {/* Target Device / Scene Picker */}
          {isSceneStep ? (
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
          {!isSceneStep && device && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                Lệnh điều khiển
              </label>
              <div className="flex flex-wrap gap-1.5">
                {deviceActions.map((opt) => {
                  const isSelected = action.action === opt.code;
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => handleActionCodeChange(opt.code)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                          : 'bg-[var(--solid)] hover:bg-[var(--muted)] text-[var(--text)] border-[var(--border)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
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

          {/* Collapsed Accordion for Raw Parameters JSON */}
          {!isSceneStep && (
            <div className="pt-1 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setJsonAccordionOpen((p) => !p)}
                className="w-full flex items-center justify-between text-left py-1 text-[11px] font-semibold text-[var(--tertiary)] hover:text-[var(--text)] transition-colors cursor-pointer"
              >
                <span>Tham số nâng cao (JSON)</span>
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
