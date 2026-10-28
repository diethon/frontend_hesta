import React, { useState, useMemo } from 'react';
import type { AutomationRule, AutomationTestResult, DeviceSummary } from '../../types/automation';
import type { SceneResponse } from '../../types/scene';
import { testAutomationRule } from '../../services/automationApi';
import { Icon } from '../home/HomeIcons';
import { PickerField } from './PickerField';
import { DevicePickerSheet } from '../scene/DevicePickerSheet';
import { StepperInput } from './StepperInput';
import { Accordion } from './Accordion';

interface RuleTestSheetProps {
  homeId: string;
  rule: AutomationRule;
  devices: DeviceSummary[];
  scenes: SceneResponse[];
  onClose: () => void;
}

export const RuleTestSheet: React.FC<RuleTestSheetProps> = ({
  homeId,
  rule,
  devices,
  scenes,
  onClose,
}) => {
  // Pre-fill source device
  const defaultDeviceId = useMemo(() => {
    return rule.conditions.find((c) => Boolean(c.deviceId))?.deviceId;
  }, [rule]);

  const [sourceDeviceId, setSourceDeviceId] = useState<string | undefined>(defaultDeviceId);
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);

  // Determine initial simulated data values from conditions
  const initialData = useMemo(() => {
    const data: Record<string, unknown> = {};
    rule.conditions.forEach((cond) => {
      if (cond.attribute && cond.attribute !== 'eventType') {
        data[cond.attribute] = cond.expectedValue;
      }
    });
    return data;
  }, [rule]);

  const [simulatedData, setSimulatedData] = useState<Record<string, unknown>>(initialData);

  // Raw JSON state & sync
  const [jsonTextOverride, setJsonTextOverride] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const eventType = useMemo(() => {
    if (rule.triggerType === 'EVENT') {
      const cond = rule.conditions.find((c) => c.attribute === 'eventType');
      return String(cond?.expectedValue || 'EVENT');
    }
    return 'SENSOR';
  }, [rule]);

  // Derived or overridden JSON text
  const jsonText = useMemo(() => {
    if (jsonTextOverride !== null) return jsonTextOverride;
    const payload = {
      sourceDeviceId: sourceDeviceId || undefined,
      eventType,
      data: simulatedData,
    };
    return JSON.stringify(payload, null, 2);
  }, [sourceDeviceId, eventType, simulatedData, jsonTextOverride]);

  // Handler for manual JSON editing
  const handleJsonChange = (val: string) => {
    setJsonTextOverride(val);
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Payload phải là một đối tượng JSON');
      }
      setJsonError(null);
      if ('sourceDeviceId' in parsed) {
        setSourceDeviceId(parsed.sourceDeviceId || undefined);
      }
      if ('data' in parsed && typeof parsed.data === 'object' && parsed.data !== null) {
        setSimulatedData(parsed.data as Record<string, unknown>);
      }
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'JSON không hợp lệ');
    }
  };

  // Test Execution State
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AutomationTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const handleRunTest = async () => {
    if (jsonError || testing) return;
    setTesting(true);
    setTestError(null);

    const payload = {
      sourceDeviceId: sourceDeviceId || undefined,
      eventType,
      data: simulatedData,
    };

    try {
      const res = await testAutomationRule(homeId, rule.id, payload);
      setTestResult(res);
      setHasRun(true);
    } catch {
      setTestError('Không thể kiểm tra quy tắc. Vui lòng thử lại.');
      setHasRun(true);
    } finally {
      setTesting(false);
    }
  };

  // Device display label
  const selectedDevice = devices.find((d) => d.id === sourceDeviceId);

  // Helper for human-readable action name
  const formatActionName = (action: string, sceneId?: string): string => {
    if (sceneId || action === 'EXECUTE_SCENE') return 'Chạy kịch bản';
    if (action === 'TURN_ON') return 'Bật';
    if (action === 'TURN_OFF') return 'Tắt';
    if (action === 'TOGGLE') return 'Đảo trạng thái';
    if (action === 'SET_BRIGHTNESS') return 'Đặt độ sáng';
    if (action === 'SET_COLOR') return 'Đổi màu đèn';
    if (action === 'SET_TEMPERATURE') return 'Đặt nhiệt độ';
    if (action === 'SET_SPEED') return 'Đặt tốc độ';
    return action;
  };

  // Operator symbols map
  const operatorLabels: Record<string, string> = {
    EQ: '=',
    NE: '≠',
    GT: '>',
    GTE: '≥',
    LT: '<',
    LTE: '≤',
  };

  return (
    <>
      <div className="scene-overlay" onClick={onClose} />
      <aside
        className="scene-panel glass-g2 z-40 flex flex-col focus:outline-none"
        role="dialog"
        aria-modal="true"
        aria-label="Kiểm tra quy tắc"
      >
        {/* ── Sticky Header ── */}
        <header className="scene-panel-header">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              className="p-1 rounded-lg text-[var(--secondary)] hover:text-[var(--text)] transition-colors cursor-pointer"
              onClick={onClose}
              aria-label="Đóng"
            >
              <Icon name="x" size={16} />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[var(--text)] truncate">Kiểm tra quy tắc</h2>
              <span className="text-[11px] text-[var(--secondary)] block truncate">
                {rule.name}
              </span>
            </div>
          </div>

          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--muted)] text-[var(--secondary)] border border-[var(--border)] shrink-0">
            {rule.triggerType === 'SENSOR' ? 'Cảm biến' : 'Sự kiện'}
          </span>
        </header>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Neutral Info Banner */}
          <div className="p-3 rounded-2xl bg-[var(--solid)] border border-[var(--border)] text-xs text-[var(--secondary)] flex items-center gap-2.5">
            <Icon name="activity" size={16} className="text-[var(--accent)] shrink-0" />
            <span>Chỉ mô phỏng điều kiện, không điều khiển thiết bị thật.</span>
          </div>

          {/* Form: SENSOR Controls */}
          {rule.triggerType === 'SENSOR' && (
            <div className="space-y-4">
              {/* Sensor Device Picker */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                  Cảm biến nguồn
                </label>
                <PickerField
                  label={selectedDevice?.name || 'Chọn cảm biến nguồn'}
                  caption={selectedDevice ? selectedDevice.roomName || 'Cảm biến' : 'Nhấn để chọn cảm biến'}
                  icon="activity"
                  statusDot={selectedDevice?.online === false ? 'offline' : 'online'}
                  onClick={() => setDevicePickerOpen(true)}
                />
              </div>

              {/* Event Type read-only chip */}
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-[11px] font-semibold text-[var(--secondary)]">
                  Loại bản tin:
                </span>
                <span className="px-2.5 py-0.5 rounded-xl text-xs font-mono font-bold bg-[var(--solid)] border border-[var(--border)] text-[var(--text)]">
                  SENSOR
                </span>
              </div>

              {/* Attribute Simulators per Condition */}
              <div className="space-y-3 pt-1">
                <span className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                  Giá trị cảm biến mô phỏng
                </span>

                {rule.conditions.map((cond, idx) => {
                  const attr = cond.attribute;
                  const currentVal = simulatedData[attr];
                  const isMotion = attr === 'motion';
                  const isBoolean =
                    typeof cond.expectedValue === 'boolean' ||
                    cond.expectedValue === 'true' ||
                    cond.expectedValue === 'false';
                  const isNumber = !isMotion && !isBoolean && !isNaN(Number(cond.expectedValue));

                  let unit = '';
                  if (attr === 'temperature') unit = '°C';
                  if (attr === 'humidity') unit = '%';
                  if (attr === 'gas') unit = 'ppm';
                  if (attr === 'brightness') unit = 'lx';

                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--solid)] space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[var(--text)] uppercase tracking-wider text-[11px]">
                          {attr}
                        </span>
                        <span className="text-[11px] text-[var(--tertiary)] font-mono">
                          Điều kiện: {operatorLabels[cond.operator] || cond.operator} {String(cond.expectedValue)}{unit}
                        </span>
                      </div>

                      {/* Number Stepper */}
                      {isNumber ? (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-[var(--secondary)]">Giá trị giả lập:</span>
                          <StepperInput
                            value={Number(currentVal ?? cond.expectedValue ?? 25)}
                            min={0}
                            max={1000}
                            step={1}
                            unit={unit}
                            onChange={(n) =>
                              setSimulatedData((prev) => ({ ...prev, [attr]: n }))
                            }
                          />
                        </div>
                      ) : isMotion ? (
                        /* Motion Segmented [Có | Không] */
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-[var(--secondary)]">Chuyển động:</span>
                          <div className="flex items-center gap-1 bg-[var(--muted)] p-0.5 rounded-xl border border-[var(--border)]">
                            <button
                              type="button"
                              onClick={() =>
                                setSimulatedData((prev) => ({ ...prev, [attr]: true }))
                              }
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                currentVal === true || currentVal === 'true'
                                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                                  : 'text-[var(--secondary)]'
                              }`}
                            >
                              Có
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setSimulatedData((prev) => ({ ...prev, [attr]: false }))
                              }
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                currentVal === false || currentVal === 'false'
                                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                                  : 'text-[var(--secondary)]'
                              }`}
                            >
                              Không
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Boolean [Bật | Tắt] */
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-[var(--secondary)]">Trạng thái:</span>
                          <div className="flex items-center gap-1 bg-[var(--muted)] p-0.5 rounded-xl border border-[var(--border)]">
                            <button
                              type="button"
                              onClick={() =>
                                setSimulatedData((prev) => ({ ...prev, [attr]: true }))
                              }
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                currentVal === true || currentVal === 'true'
                                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                                  : 'text-[var(--secondary)]'
                              }`}
                            >
                              Bật
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setSimulatedData((prev) => ({ ...prev, [attr]: false }))
                              }
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                currentVal === false || currentVal === 'false'
                                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                                  : 'text-[var(--secondary)]'
                              }`}
                            >
                              Tắt
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form: EVENT Controls */}
          {rule.triggerType === 'EVENT' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                  Sự kiện kiểm tra
                </label>
                <div className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--solid)] flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text)]">
                    {eventType}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent-soft)] text-[var(--accent)]">
                    Được theo dõi
                  </span>
                </div>
              </div>

              {/* Source device if specified */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                  Thiết bị phát sinh sự kiện (tùy chọn)
                </label>
                <PickerField
                  label={selectedDevice?.name || 'Bất kỳ thiết bị nào'}
                  caption={selectedDevice ? selectedDevice.roomName || 'Thiết bị' : 'Không giới hạn thiết bị nguồn'}
                  icon="zap"
                  onClick={() => setDevicePickerOpen(true)}
                />
              </div>
            </div>
          )}

          {/* Collapsed Accordion: JSON nâng cao */}
          <Accordion title="Dữ liệu JSON (nâng cao)">
            <div className="space-y-2 pt-1">
              <textarea
                value={jsonText}
                onChange={(e) => handleJsonChange(e.target.value)}
                rows={6}
                className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--solid)] font-mono text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                placeholder="Payload JSON..."
              />
              {jsonError && (
                <p className="text-xs text-rose-500 font-medium">{jsonError}</p>
              )}
            </div>
          </Accordion>

          {/* ── Test Result Card (G1) ── */}
          {hasRun && (
            <div className="space-y-3 pt-2">
              <span className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                Kết quả kiểm tra
              </span>

              {testError ? (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 space-y-1">
                  <strong>Không thể kiểm tra quy tắc</strong>
                  <p>{testError}</p>
                </div>
              ) : testResult?.matched ? (
                /* MATCHED = TRUE */
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Icon name="check" size={12} className="text-emerald-700" />
                    </span>
                    <span>
                      Điều kiện khớp · Quy tắc sẽ chạy {testResult.proposedActions.length} hành động
                    </span>
                  </div>

                  {/* Proposed Actions neutral list */}
                  <div className="space-y-1.5 pt-1">
                    {testResult.proposedActions.map((act, actIdx) => {
                      let targetName = 'Thiết bị';
                      if (act.sceneId) {
                        const sc = scenes.find((s) => s.id === act.sceneId);
                        targetName = sc ? sc.name : 'Kịch bản đã bị xóa';
                      } else if (act.deviceId) {
                        const dev = devices.find((d) => d.id === act.deviceId);
                        targetName = dev ? dev.name : 'Thiết bị đã bị xóa';
                      }

                      const isDeleted =
                        targetName.includes('đã bị xóa') ||
                        (!act.deviceId && !act.sceneId);

                      return (
                        <div
                          key={actIdx}
                          className="p-2.5 rounded-xl bg-[var(--solid)] border border-[var(--border)] flex items-center justify-between text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <span
                              className={`font-semibold block truncate ${
                                isDeleted ? 'text-[var(--tertiary)] italic' : 'text-[var(--text)]'
                              }`}
                            >
                              {targetName}
                            </span>
                            <span className="text-[11px] text-[var(--secondary)] block truncate">
                              {formatActionName(act.action, act.sceneId)}
                            </span>
                          </div>

                          <span className="text-[10px] text-[var(--tertiary)] font-medium px-2 py-0.5 rounded-md bg-[var(--muted)] shrink-0">
                            Chưa thực thi
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* MATCHED = FALSE */
                <div className="p-4 rounded-2xl bg-[var(--solid)] border border-[var(--border)] space-y-3">
                  <div className="flex items-center gap-2 text-[var(--secondary)] text-xs font-bold">
                    <span className="w-5 h-5 rounded-full bg-[var(--muted)] flex items-center justify-center">
                      <Icon name="alert" size={12} className="text-[var(--tertiary)]" />
                    </span>
                    <span>Điều kiện không khớp · Quy tắc sẽ không chạy</span>
                  </div>

                  {/* Echo user inputs next to conditions (readability only, no client pass/fail) */}
                  <div className="p-3 rounded-xl bg-[var(--muted)]/50 border border-[var(--border)] text-xs space-y-1.5">
                    <span className="text-[11px] font-bold text-[var(--secondary)] block">
                      Đối chiếu dữ liệu:
                    </span>
                    {rule.conditions.map((cond, cIdx) => {
                      const entered = simulatedData[cond.attribute];
                      return (
                        <div
                          key={cIdx}
                          className="flex items-center justify-between text-[11px] text-[var(--secondary)]"
                        >
                          <span>{cond.attribute}:</span>
                          <span className="font-mono">
                            Bạn nhập: <strong className="text-[var(--text)]">{String(entered ?? 'Chưa nhập')}</strong> ·
                            Điều kiện: {operatorLabels[cond.operator] || cond.operator} {String(cond.expectedValue)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Sticky Footer ── */}
        <footer className="scene-panel-footer">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl text-xs font-semibold text-[var(--secondary)] hover:bg-[var(--muted)] border border-[var(--border)] transition-colors cursor-pointer"
            >
              Đóng
            </button>

            <button
              type="button"
              disabled={Boolean(jsonError) || testing}
              onClick={handleRunTest}
              className="flex-1 py-3 rounded-2xl text-xs font-bold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {testing ? (
                <>
                  <Icon name="clock" size={14} className="animate-spin" />
                  <span>Đang kiểm tra...</span>
                </>
              ) : (
                <span>{hasRun ? 'Kiểm tra lại' : 'Kiểm tra'}</span>
              )}
            </button>
          </div>
        </footer>
      </aside>

      {/* ── Device Picker Sub-Sheet ── */}
      {devicePickerOpen && (
        <DevicePickerSheet
          devices={devices}
          filterMode={rule.triggerType === 'SENSOR' ? 'sensors-only' : 'all'}
          selectedDeviceId={sourceDeviceId}
          title={
            rule.triggerType === 'SENSOR'
              ? 'Chọn cảm biến nguồn'
              : 'Chọn thiết bị phát sinh sự kiện'
          }
          onSelect={(dev) => {
            setSourceDeviceId(dev.id);
            setDevicePickerOpen(false);
          }}
          onClose={() => setDevicePickerOpen(false)}
        />
      )}
    </>
  );
};
