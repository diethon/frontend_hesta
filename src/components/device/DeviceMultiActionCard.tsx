import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Trash2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import {
  type AnyDevice,
  type DeviceMultiActionState,
  COLOR_PRESETS,
  AC_MODES,
  AC_FAN_LEVELS,
  getDeviceCapabilityProfile,
  parseActionToMultiState,
  serializeMultiStateToAction,
} from './deviceMultiActionHelpers';
import { resolveEffectiveType } from './deviceHelpers';

export interface DeviceMultiActionCardProps {
  action: { deviceId: string; action: string; value: string };
  index: number;
  totalActions: number;
  devices: AnyDevice[];
  onUpdate: (patch: { action: string; value: string; parameters?: Record<string, unknown> }) => void;
  onChangeDevice: (deviceId: string) => void;
  onMove?: (direction: -1 | 1) => void;
  onRemove: () => void;
  disabled?: boolean;
  stepLabel?: string;
}

export const DeviceMultiActionCard: React.FC<DeviceMultiActionCardProps> = ({
  action,
  index,
  totalActions,
  devices,
  onUpdate,
  onChangeDevice,
  onMove,
  onRemove,
  disabled = false,
  stepLabel,
}) => {
  const selectedDevice = devices.find((d) => d.id === action.deviceId);
  const profile = getDeviceCapabilityProfile(selectedDevice);

  // Parse draft action into internal multi-capability form state
  const [state, setState] = useState<DeviceMultiActionState>(() =>
    parseActionToMultiState(action.action, action.value, selectedDevice)
  );
  const [showJson, setShowJson] = useState(false);

  // Keep internal state synchronized when action prop changes from parent
  useEffect(() => {
    setState(parseActionToMultiState(action.action, action.value, selectedDevice));
  }, [action.deviceId, action.action, action.value, selectedDevice]);

  // Notify parent on internal state changes
  const applyStateUpdate = (updater: (prev: DeviceMultiActionState) => DeviceMultiActionState) => {
    setState((prev) => {
      const next = updater(prev);
      const serialized = serializeMultiStateToAction(next, selectedDevice);
      onUpdate({
        action: serialized.action,
        value: serialized.value,
        parameters: serialized.parameters,
      });
      return next;
    });
  };

  const handlePowerChange = (power: 'ON' | 'OFF' | 'TOGGLE') => {
    applyStateUpdate((prev) => ({
      ...prev,
      power,
      // If user specifically clicks Bật and has brightness or color, keep them active
      enableBrightness: power === 'OFF' ? false : prev.enableBrightness,
      enableColor: power === 'OFF' ? false : prev.enableColor,
    }));
  };

  const serialized = serializeMultiStateToAction(state, selectedDevice);
  const isAc = profile.isAc;
  const effectiveType = selectedDevice ? (isAc ? 'AIR_CONDITIONER' : resolveEffectiveType(selectedDevice as any).toUpperCase()) : '';

  return (
    <article className="relative rounded-2xl border border-line bg-surface p-4 sm:p-5 transition-all shadow-2xs hover:shadow-xs space-y-4">
      {/* ── CARD HEADER & STEP NUMBER ── */}
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/10 text-primary font-bold text-xs border border-primary/20">
            {index + 1}
          </span>
          <span className="text-xs font-bold text-text uppercase tracking-wider">
            {stepLabel ? `${stepLabel} ${index + 1}` : `Hành động ${index + 1}`}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onMove && (
            <>
              <button
                type="button"
                disabled={disabled || index === 0}
                onClick={() => onMove(-1)}
                className="p-1 rounded-lg text-muted hover:text-text hover:bg-sidebar disabled:opacity-25 transition-colors cursor-pointer"
                title="Đưa lên trước"
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                disabled={disabled || index === totalActions - 1}
                onClick={() => onMove(1)}
                className="p-1 rounded-lg text-muted hover:text-text hover:bg-sidebar disabled:opacity-25 transition-colors cursor-pointer"
                title="Đưa xuống sau"
              >
                <ArrowDown size={14} />
              </button>
            </>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={onRemove}
            className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors ml-1 cursor-pointer"
            title="Xóa hành động này"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ── DEVICE SELECTOR & METADATA ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-sidebar/50 border border-line">
        <div className="min-w-0">
          <h4 className="font-bold text-sm text-text truncate">
            {selectedDevice?.name || 'Chưa chọn thiết bị'}
          </h4>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted">
            <span>{selectedDevice?.roomName || 'Chung'}</span>
            <span>·</span>
            <span className="font-medium">{effectiveType || 'Thiết bị'}</span>
            {selectedDevice?.status && (
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  selectedDevice.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
                title={`Trạng thái: ${selectedDevice.status}`}
              />
            )}
          </div>
        </div>

        <div className="shrink-0 w-full sm:w-auto">
          <select
            value={action.deviceId}
            onChange={(e) => onChangeDevice(e.target.value)}
            disabled={disabled}
            className="w-full sm:w-52 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-text focus:border-primary focus:outline-none shadow-2xs"
            aria-label="Chọn thiết bị điều khiển"
          >
            <option value="" disabled>
              -- Chọn thiết bị --
            </option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.roomName || 'Chung'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedDevice && (
        <div className="space-y-4 pt-1">
          {/* ── 1. POWER CONTROL (BẬT / TẮT / ĐẢO TRẠNG THÁI) ── */}
          {profile.hasPower && !profile.hasGate && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                1. Trạng thái nguồn:
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handlePowerChange('ON')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    state.power === 'ON'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-surface hover:bg-sidebar text-text border border-line'
                  }`}
                >
                  Bật nguồn (ON)
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handlePowerChange('OFF')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    state.power === 'OFF'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'bg-surface hover:bg-sidebar text-text border border-line'
                  }`}
                >
                  Tắt nguồn (OFF)
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handlePowerChange('TOGGLE')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    state.power === 'TOGGLE'
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-surface hover:bg-sidebar text-text border border-line'
                  }`}
                >
                  Đảo bật/tắt
                </button>
              </div>
            </div>
          )}

          {/* ── 2. BRIGHTNESS (ĐỘ SÁNG) ── */}
          {profile.hasBrightness && state.power !== 'OFF' && (
            <div className="space-y-2 rounded-xl bg-sidebar/40 border border-line p-3">
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 font-bold text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.enableBrightness}
                    disabled={disabled}
                    onChange={(e) =>
                      applyStateUpdate((prev) => ({
                        ...prev,
                        enableBrightness: e.target.checked,
                        power: 'ON',
                      }))
                    }
                    className="rounded accent-primary w-4 h-4 cursor-pointer"
                  />
                  <span>Cài đặt độ sáng:</span>
                </label>
                <span
                  className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg border ${
                    state.enableBrightness
                      ? 'bg-amber-500/10 text-amber-700 border-amber-300'
                      : 'bg-surface text-muted border-line'
                  }`}
                >
                  {state.brightness}%
                </span>
              </div>

              {state.enableBrightness && (
                <div className="space-y-2 pt-1 pl-6">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      disabled={disabled}
                      value={state.brightness}
                      onChange={(e) =>
                        applyStateUpdate((prev) => ({
                          ...prev,
                          enableBrightness: true,
                          brightness: Number(e.target.value),
                        }))
                      }
                      className="flex-1 accent-amber-500 cursor-pointer h-2 bg-sidebar rounded-lg"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      disabled={disabled}
                      value={state.brightness}
                      onChange={(e) =>
                        applyStateUpdate((prev) => ({
                          ...prev,
                          enableBrightness: true,
                          brightness: Math.max(0, Math.min(100, Number(e.target.value))),
                        }))
                      }
                      className="w-16 rounded-xl border border-line px-2 py-1 text-xs text-center font-bold bg-surface text-text"
                    />
                  </div>

                  {/* Quick Presets */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: '25% (Ngủ)', val: 25 },
                      { label: '50% (Dịu)', val: 50 },
                      { label: '75% (Chuẩn)', val: 75 },
                      { label: '100% (Sáng)', val: 100 },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          applyStateUpdate((prev) => ({
                            ...prev,
                            enableBrightness: true,
                            brightness: p.val,
                          }))
                        }
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          state.brightness === p.val
                            ? 'bg-amber-500 text-white'
                            : 'bg-surface hover:bg-sidebar text-text border border-line'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 3. COLOR RGB (MÀU SẮC ĐÈN) ── */}
          {profile.hasColor && state.power !== 'OFF' && (
            <div className="space-y-2 rounded-xl bg-sidebar/40 border border-line p-3">
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 font-bold text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.enableColor}
                    disabled={disabled}
                    onChange={(e) =>
                      applyStateUpdate((prev) => ({
                        ...prev,
                        enableColor: e.target.checked,
                        power: 'ON',
                      }))
                    }
                    className="rounded accent-primary w-4 h-4 cursor-pointer"
                  />
                  <span>Cài đặt màu sắc RGB:</span>
                </label>
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/20"
                    style={{ backgroundColor: state.color }}
                  />
                  <span className="uppercase text-text">{state.color}</span>
                </div>
              </div>

              {state.enableColor && (
                <div className="space-y-2 pt-1 pl-6">
                  {/* Color Swatches Grid */}
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map((c) => {
                      const isSelected = state.color.toLowerCase() === c.hex.toLowerCase();
                      return (
                        <button
                          key={c.hex}
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            applyStateUpdate((prev) => ({
                              ...prev,
                              enableColor: true,
                              color: c.hex,
                            }))
                          }
                          className="w-7 h-7 rounded-full border border-black/20 flex items-center justify-center transition-transform hover:scale-110 cursor-pointer"
                          style={{ backgroundColor: c.hex }}
                          title={c.label}
                        >
                          {isSelected && <Check size={12} className="text-white drop-shadow stroke-[3]" />}
                        </button>
                      );
                    })}

                    <label className="flex items-center gap-1.5 cursor-pointer bg-surface px-2 py-0.5 rounded-lg border border-line hover:border-primary">
                      <input
                        type="color"
                        disabled={disabled}
                        value={state.color}
                        onChange={(e) =>
                          applyStateUpdate((prev) => ({
                            ...prev,
                            enableColor: true,
                            color: e.target.value,
                          }))
                        }
                        className="w-4 h-4 cursor-pointer bg-transparent border-0 p-0"
                      />
                      <span className="text-[10px] text-muted font-semibold">Tùy chọn</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 4. AIR CONDITIONER (NHIỆT ĐỘ, CHẾ ĐỘ, MỨC GIÓ) ── */}
          {profile.isAc && state.power !== 'OFF' && (
            <div className="space-y-3 rounded-xl bg-sidebar/40 border border-line p-3">
              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 font-bold text-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.enableTemp}
                      disabled={disabled}
                      onChange={(e) =>
                        applyStateUpdate((prev) => ({
                          ...prev,
                          enableTemp: e.target.checked,
                          power: 'ON',
                        }))
                      }
                      className="rounded accent-primary w-4 h-4 cursor-pointer"
                    />
                    <span>Nhiệt độ mục tiêu:</span>
                  </label>
                  <span className="font-bold text-primary text-xs">{state.temperature}°C</span>
                </div>

                {state.enableTemp && (
                  <div className="space-y-2 pl-6">
                    <div className="flex items-center justify-center gap-3 py-1">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          applyStateUpdate((prev) => ({
                            ...prev,
                            enableTemp: true,
                            temperature: Math.max(16, prev.temperature - 1),
                          }))
                        }
                        className="w-9 h-9 rounded-xl border border-line bg-surface font-extrabold text-base hover:bg-sidebar text-text active:scale-95 transition-all cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-2xl font-black text-text min-w-[70px] text-center">
                        {state.temperature}°C
                      </span>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          applyStateUpdate((prev) => ({
                            ...prev,
                            enableTemp: true,
                            temperature: Math.min(32, prev.temperature + 1),
                          }))
                        }
                        className="w-9 h-9 rounded-xl border border-line bg-surface font-extrabold text-base hover:bg-sidebar text-text active:scale-95 transition-all cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex flex-wrap justify-center gap-1.5">
                      {[18, 22, 24, 26].map((t) => (
                        <button
                          key={t}
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            applyStateUpdate((prev) => ({
                              ...prev,
                              enableTemp: true,
                              temperature: t,
                            }))
                          }
                          className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer ${
                            state.temperature === t
                              ? 'bg-primary text-white'
                              : 'bg-surface hover:bg-sidebar text-text border border-line'
                          }`}
                        >
                          {t}°C
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* AC Mode */}
              <div className="space-y-1.5 pt-2 border-t border-line">
                <label className="flex items-center gap-2 text-xs font-bold text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.enableMode}
                    disabled={disabled}
                    onChange={(e) =>
                      applyStateUpdate((prev) => ({
                        ...prev,
                        enableMode: e.target.checked,
                        power: 'ON',
                      }))
                    }
                    className="rounded accent-primary w-4 h-4 cursor-pointer"
                  />
                  <span>Chế độ điều hòa:</span>
                </label>

                {state.enableMode && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pl-6 pt-1">
                    {AC_MODES.map((m) => {
                      const isSelected = state.mode === m.code;
                      return (
                        <button
                          key={m.code}
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            applyStateUpdate((prev) => ({
                              ...prev,
                              enableMode: true,
                              mode: m.code,
                            }))
                          }
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-primary text-white shadow-xs'
                              : 'bg-surface hover:bg-sidebar text-text border border-line'
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* AC Fan Speed */}
              <div className="space-y-1.5 pt-2 border-t border-line">
                <label className="flex items-center gap-2 text-xs font-bold text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.enableFan}
                    disabled={disabled}
                    onChange={(e) =>
                      applyStateUpdate((prev) => ({
                        ...prev,
                        enableFan: e.target.checked,
                        power: 'ON',
                      }))
                    }
                    className="rounded accent-primary w-4 h-4 cursor-pointer"
                  />
                  <span>Mức gió điều hòa:</span>
                </label>

                {state.enableFan && (
                  <div className="grid grid-cols-4 gap-1.5 pl-6 pt-1">
                    {AC_FAN_LEVELS.map((f) => {
                      const isSelected = state.fan.toUpperCase() === f.code;
                      return (
                        <button
                          key={f.code}
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            applyStateUpdate((prev) => ({
                              ...prev,
                              enableFan: true,
                              fan: f.code,
                            }))
                          }
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-primary text-white shadow-xs'
                              : 'bg-surface hover:bg-sidebar text-text border border-line'
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 5. FAN SPEED (QUẠT THƯỜNG) ── */}
          {profile.hasFan && !profile.isAc && state.power !== 'OFF' && (
            <div className="space-y-2 rounded-xl bg-sidebar/40 border border-line p-3">
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 font-bold text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.enableFan}
                    disabled={disabled}
                    onChange={(e) =>
                      applyStateUpdate((prev) => ({
                        ...prev,
                        enableFan: e.target.checked,
                        power: 'ON',
                      }))
                    }
                    className="rounded accent-primary w-4 h-4 cursor-pointer"
                  />
                  <span>Tốc độ quạt:</span>
                </label>
                <span className="font-bold text-primary">{state.fan}%</span>
              </div>

              {state.enableFan && (
                <div className="space-y-2 pt-1 pl-6">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      disabled={disabled}
                      value={Number(state.fan) || 50}
                      onChange={(e) =>
                        applyStateUpdate((prev) => ({
                          ...prev,
                          enableFan: true,
                          fan: e.target.value,
                        }))
                      }
                      className="flex-1 accent-primary cursor-pointer h-2 bg-sidebar rounded-lg"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      disabled={disabled}
                      value={Number(state.fan) || 50}
                      onChange={(e) =>
                        applyStateUpdate((prev) => ({
                          ...prev,
                          enableFan: true,
                          fan: e.target.value,
                        }))
                      }
                      className="w-16 rounded-xl border border-line px-2 py-1 text-xs text-center font-bold bg-surface text-text"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: 'Yếu', val: '25' },
                      { label: 'Vừa', val: '50' },
                      { label: 'Mạnh', val: '75' },
                      { label: 'Tối đa', val: '100' },
                    ].map((s) => (
                      <button
                        key={s.val}
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          applyStateUpdate((prev) => ({
                            ...prev,
                            enableFan: true,
                            fan: s.val,
                          }))
                        }
                        className={`py-1 px-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                          state.fan === s.val
                            ? 'bg-primary text-white'
                            : 'bg-surface hover:bg-sidebar text-text border border-line'
                        }`}
                      >
                        {s.label} ({s.val}%)
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 6. GATE / DOOR (MỞ / ĐÓNG / DỪNG) ── */}
          {profile.hasGate && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                Lệnh đóng mở cửa cổng:
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { code: 'OPEN', label: 'Mở cửa', color: 'bg-emerald-600' },
                  { code: 'CLOSE', label: 'Đóng cửa', color: 'bg-slate-700' },
                  { code: 'STOP', label: 'Dừng lại', color: 'bg-rose-600' },
                ].map((btn) => (
                  <button
                    key={btn.code}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      applyStateUpdate((prev) => ({
                        ...prev,
                        gateAction: btn.code as any,
                      }))
                    }
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      state.gateAction === btn.code
                        ? `${btn.color} text-white shadow-xs`
                        : 'bg-surface hover:bg-sidebar text-text border border-line'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── 7. ADVANCED JSON ACCORDION ── */}
          <div className="pt-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setShowJson(!showJson)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-text cursor-pointer"
            >
              <span>Tùy chỉnh JSON nâng cao</span>
              {showJson ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showJson && (
              <div className="space-y-2 mt-2 p-3 rounded-xl bg-sidebar/50 border border-line">
                <textarea
                  disabled={disabled}
                  rows={3}
                  value={state.customJson}
                  onChange={(e) =>
                    applyStateUpdate((prev) => ({
                      ...prev,
                      isCustomJson: true,
                      customJson: e.target.value,
                    }))
                  }
                  placeholder='{"power": "ON", "brightness": 80, "color": "#ff7043"}'
                  className="w-full rounded-xl border border-line bg-surface p-2 text-xs font-mono text-text focus:border-primary focus:outline-none resize-none"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    applyStateUpdate((prev) => ({
                      ...prev,
                      isCustomJson: false,
                    }))
                  }
                  className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                >
                  ← Đặt lại theo giao diện điều khiển
                </button>
              </div>
            )}
          </div>

          {/* ── 8. LIVE COMMAND SUMMARY BANNER ── */}
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-wider font-bold text-primary block">
                Lệnh gửi khi thực thi:
              </span>
              <p className="font-bold text-text truncate mt-0.5">
                {serialized.summary || 'Chưa thiết lập'}
              </p>
            </div>
            <span className="shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {serialized.action}
            </span>
          </div>
        </div>
      )}

      {!selectedDevice && (
        <p className="text-xs text-amber-700 italic bg-amber-50 p-3 rounded-xl border border-amber-200">
          Vui lòng chọn thiết bị ở danh sách trên để xem các khả năng và thiết lập hành động.
        </p>
      )}
    </article>
  );
};
