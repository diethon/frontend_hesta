import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { AutomationRule, AutomationExecution, DeviceSummary } from '../../types/automation';
import type { SceneResponse } from '../../types/scene';
import { getAutomationExecutions } from '../../services/automationApi';
import { Icon } from '../home/HomeIcons';

interface RuleHistoryPanelProps {
  homeId: string;
  rule: AutomationRule;
  devices: DeviceSummary[];
  scenes: SceneResponse[];
  onClose?: () => void;
  isInline?: boolean; // When rendered inside RuleEditorPanel tab
}

type FilterKey = 'ALL' | 'SUCCESS' | 'ERROR' | 'SKIPPED';

export const RuleHistoryPanel: React.FC<RuleHistoryPanelProps> = ({
  homeId,
  rule,
  devices,
  scenes,
  onClose,
  isInline = false,
}) => {
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [showTests, setShowTests] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!homeId || !rule?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAutomationExecutions(homeId, rule.id);
      setExecutions(data || []);
    } catch {
      setError('Không thể tải lịch sử chạy quy tắc. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [homeId, rule?.id]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  // Filtered executions
  const filtered = useMemo(() => {
    return executions.filter((exec) => {
      // Test filter
      if (!showTests && exec.test) return false;

      // Status filter
      if (filter === 'SUCCESS') return exec.status === 'SUCCESS';
      if (filter === 'ERROR') return exec.status === 'FAILED' || exec.status === 'PARTIAL';
      if (filter === 'SKIPPED') return exec.status === 'SKIPPED';
      return true;
    });
  }, [executions, showTests, filter]);

  // Group by day on client: "Hôm nay", "Hôm qua", dd/MM/yyyy
  const groupedByDay = useMemo(() => {
    const today = new Date();
    const todayStr = today.toDateString();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const map = new Map<string, AutomationExecution[]>();

    filtered.forEach((item) => {
      const d = new Date(item.matchedAt || item.startedAt || 0);
      let groupKey: string;
      if (d.toDateString() === todayStr) {
        groupKey = 'Hôm nay';
      } else if (d.toDateString() === yesterdayStr) {
        groupKey = 'Hôm qua';
      } else {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        groupKey = `${day}/${month}/${year}`;
      }

      const list = map.get(groupKey) || [];
      list.push(item);
      map.set(groupKey, list);
    });

    return Array.from(map.entries());
  }, [filtered]);

  // Helper for human-readable trigger
  const formatTrigger = (triggerSource?: string): string => {
    if (!triggerSource) return 'Tự động';
    const s = triggerSource.toUpperCase();
    if (s === 'SCHEDULE') return 'Lịch hẹn giờ';
    if (s === 'SENSOR') return 'Dữ liệu cảm biến';
    if (s === 'EVENT') return 'Sự kiện thiết bị';
    if (s === 'MANUAL_OVERRIDE') return 'Ghi đè thủ công';
    return 'Tự động';
  };

  // Helper for human-readable action name
  const formatActionName = (action: string, sceneId?: string): string => {
    if (sceneId || action === 'EXECUTE_SCENE') return 'Chạy kịch bản';
    if (action === 'TURN_ON') return 'Bật thiết bị';
    if (action === 'TURN_OFF') return 'Tắt thiết bị';
    if (action === 'TOGGLE') return 'Đảo trạng thái';
    if (action === 'SET_BRIGHTNESS') return 'Đặt độ sáng';
    if (action === 'SET_COLOR') return 'Đổi màu đèn';
    if (action === 'SET_TEMPERATURE') return 'Đặt nhiệt độ';
    if (action === 'SET_SPEED') return 'Đặt tốc độ quạt';
    if (action === 'OPEN_GATE') return 'Mở cổng';
    if (action === 'CLOSE_GATE') return 'Đóng cổng';
    return action;
  };

  // Render Status Badge / Icon
  const renderStatus = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <span className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Icon name="check" size={12} className="text-emerald-600" />
            </span>
            <span>Thành công</span>
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
            <span className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Icon name="alert" size={12} className="text-amber-600" />
            </span>
            <span>Một phần</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
            <span className="w-5 h-5 rounded-full bg-rose-500/10 flex items-center justify-center">
              <Icon name="x" size={12} className="text-rose-600" />
            </span>
            <span>Thất bại</span>
          </span>
        );
      case 'SKIPPED':
      default:
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--secondary)]">
            <span className="w-5 h-5 rounded-full bg-[var(--muted)] flex items-center justify-center">
              <Icon name="clock" size={12} className="text-[var(--tertiary)]" />
            </span>
            <span>Bỏ qua</span>
          </span>
        );
    }
  };

  const content = (
    <div className="space-y-4">
      {/* ── Filters & Options ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Filter chips */}
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[var(--solid)] border border-[var(--border)]">
          {(
            [
              { id: 'ALL', label: 'Tất cả' },
              { id: 'SUCCESS', label: 'Thành công' },
              { id: 'ERROR', label: 'Có lỗi' },
              { id: 'SKIPPED', label: 'Đã bỏ qua' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filter === item.id
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'text-[var(--secondary)] hover:text-[var(--text)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Small toggle: Hiện lần kiểm tra */}
        <label className="flex items-center gap-2 text-xs text-[var(--secondary)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showTests}
            onChange={(e) => setShowTests(e.target.checked)}
            className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-0 cursor-pointer"
          />
          <span>Hiện lần kiểm tra</span>
        </label>
      </div>

      {/* ── List Content ── */}
      {loading ? (
        <div className="space-y-3 py-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 rounded-2xl bg-[var(--muted)]/40 animate-pulse border border-[var(--border)]"
            />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-2">
          <p className="text-xs text-rose-600 font-medium">{error}</p>
          <button
            type="button"
            onClick={fetchHistory}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-[var(--border)] text-center space-y-2">
          <p className="text-xs text-[var(--secondary)]">
            {executions.length === 0
              ? 'Chưa có lần chạy nào cho quy tắc này.'
              : 'Không có kết quả phù hợp với bộ lọc hiện tại.'}
          </p>
          {executions.length > 0 && filter !== 'ALL' && (
            <button
              type="button"
              onClick={() => {
                setFilter('ALL');
                setShowTests(true);
              }}
              className="text-xs text-[var(--accent)] font-bold hover:underline cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByDay.map(([groupLabel, items]) => (
            <div key={groupLabel} className="space-y-2">
              <span className="text-[11px] font-bold text-[var(--tertiary)] uppercase tracking-wider block">
                {groupLabel}
              </span>

              <div className="space-y-2">
                {items.map((exec) => {
                  const isExpanded = expandedRowId === exec.id;
                  const dateObj = new Date(exec.matchedAt || exec.startedAt || Date.now());
                  const timeStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(
                    dateObj.getMinutes()
                  ).padStart(2, '0')}`;

                  const details = Array.isArray(exec.resultDetail) ? exec.resultDetail : [];
                  const successCount = details.filter((d) => d.success).length;
                  const totalCount = details.length || rule.actions.length;

                  return (
                    <div
                      key={exec.id}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--solid)] hover:bg-[var(--muted)]/40 transition-colors overflow-hidden"
                    >
                      {/* Row Header (56px) */}
                      <button
                        type="button"
                        onClick={() => setExpandedRowId(isExpanded ? null : exec.id)}
                        className="w-full min-h-[56px] px-3.5 py-2.5 flex items-center justify-between text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <span className="text-xs font-mono font-bold text-[var(--text)] shrink-0">
                            {timeStr}
                          </span>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {renderStatus(exec.status)}
                              {exec.test && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--muted)] text-[var(--secondary)] border border-[var(--border)] shrink-0">
                                  Kiểm tra
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[var(--secondary)] block truncate mt-0.5">
                              {formatTrigger(exec.triggerSource)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-semibold text-[var(--secondary)]">
                            {successCount}/{totalCount} hành động
                          </span>
                          <Icon
                            name={isExpanded ? 'chevronUp' : 'chevron'}
                            size={14}
                            className="text-[var(--tertiary)]"
                          />
                        </div>
                      </button>

                      {/* Expanded Result Detail */}
                      {isExpanded && (
                        <div className="px-3.5 pb-3 pt-1 border-t border-[var(--border)] space-y-2 bg-[var(--muted)]/20">
                          {details.length === 0 ? (
                            <p className="text-xs text-[var(--tertiary)] italic">
                              Không có dữ liệu chi tiết cho lần chạy này.
                            </p>
                          ) : (
                            details.map((detail, dIdx) => {
                              let targetName = 'Thiết bị';
                              if (detail.sceneId) {
                                const sc = scenes.find((s) => s.id === detail.sceneId);
                                targetName = sc ? sc.name : 'Kịch bản đã bị xóa';
                              } else if (detail.deviceId) {
                                const dev = devices.find((d) => d.id === detail.deviceId);
                                targetName = dev ? dev.name : 'Thiết bị đã bị xóa';
                              }

                              const isDeleted =
                                targetName.includes('đã bị xóa') ||
                                (!detail.deviceId && !detail.sceneId);

                              return (
                                <div
                                  key={dIdx}
                                  className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--border)] last:border-b-0"
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
                                      {formatActionName(detail.action, detail.sceneId)}
                                    </span>
                                  </div>

                                  <div className="shrink-0">
                                    {detail.success ? (
                                      <span className="text-emerald-600 font-semibold text-[11px] flex items-center gap-1">
                                        <Icon name="check" size={12} />
                                        <span>Thành công</span>
                                      </span>
                                    ) : (
                                      <span className="text-rose-600 font-semibold text-[11px] flex items-center gap-1">
                                        <Icon name="x" size={12} />
                                        <span>Thất bại</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Caption at bottom */}
          <p className="text-[11px] text-[var(--tertiary)] text-center pt-2">
            Hiển thị tối đa 100 lần chạy gần nhất
          </p>
        </div>
      )}
    </div>
  );

  // If used inline inside RuleEditorPanel tab:
  if (isInline) {
    return content;
  }

  // If opened standalone from RuleCard ⋯ menu:
  return (
    <>
      <div className="scene-overlay" onClick={onClose} />
      <aside
        className="scene-panel glass-g2 z-40 flex flex-col focus:outline-none"
        role="dialog"
        aria-modal="true"
        aria-label="Lịch sử chạy"
      >
        <header className="scene-panel-header">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              className="p-1 rounded-lg text-[var(--secondary)] hover:text-[var(--text)]"
              onClick={onClose}
              aria-label="Đóng"
            >
              <Icon name="x" size={16} />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[var(--text)] truncate">Lịch sử chạy</h2>
              <span className="text-[11px] text-[var(--secondary)] block truncate">
                {rule.name}
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4">{content}</div>
      </aside>
    </>
  );
};
