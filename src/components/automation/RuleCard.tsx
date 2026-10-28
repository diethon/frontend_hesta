import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Icon, type IconName } from '../home/HomeIcons';
import type { AutomationRule, DeviceSummary } from '../../types/automation';
import type { SceneResponse } from '../../types/scene';

export interface RuleCardProps {
  rule?: AutomationRule;
  loading?: boolean;
  devices?: DeviceSummary[];
  scenes?: SceneResponse[];
  lastRunFailed?: boolean;
  onToggle?: (enabled: boolean) => void;
  onEdit?: () => void;
  onTest?: () => void;
  onHistory?: () => void;
  onSchedule?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

export const RuleCard: React.FC<RuleCardProps> = ({
  rule,
  loading = false,
  devices = [],
  scenes = [],
  lastRunFailed = false,
  onToggle,
  onEdit,
  onTest,
  onHistory,
  onSchedule,
  onDuplicate,
  onDelete,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [menuOpen]);

  // Loading skeleton state
  if (loading || !rule) {
    return (
      <article className="scenario-card glass-g1 off animate-pulse min-h-[170px] flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-2xl bg-slate-200/50" />
          <div className="w-11 h-6 rounded-full bg-slate-200/50" />
        </div>
        <div className="space-y-2 py-2">
          <div className="h-4 bg-slate-200/60 rounded-md w-3/4" />
          <div className="h-3 bg-slate-200/40 rounded-md w-1/2" />
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
          <div className="h-3 bg-slate-200/40 rounded-md w-1/3" />
          <div className="w-8 h-8 rounded-full bg-slate-200/40" />
        </div>
      </article>
    );
  }

  const isIncomplete = !rule.actions || rule.actions.length === 0;
  const isSchedule = rule.triggerType === 'SCHEDULE';
  const triggerIcon: IconName =
    rule.triggerType === 'SENSOR' ? 'activity' : isSchedule ? 'clock' : 'zap';

  // Format trigger summary
  const triggerSummary = useMemo(() => {
    if (isSchedule) {
      return 'Theo lịch hẹn giờ';
    }
    if (rule.triggerType === 'EVENT') {
      const first = rule.conditions[0];
      return `Khi có sự kiện ${first?.expectedValue || first?.attribute || 'hệ thống'}`;
    }
    if (!rule.conditions.length) {
      return 'Chưa cấu hình điều kiện';
    }
    const first = rule.conditions[0];
    const dev = devices.find((d) => d.id === first.deviceId);
    const devName = dev?.name || 'cảm biến';
    const attr = first.attribute === 'temperature' ? 'nhiệt độ' : first.attribute === 'motion' ? 'chuyển động' : first.attribute;
    const op = first.operator === 'GT' ? '>' : first.operator === 'LT' ? '<' : '=';
    return `Khi ${attr} ${devName} ${op} ${first.expectedValue ?? ''}`;
  }, [rule, devices, isSchedule]);

  // Format result line (actions)
  const resultSummary = useMemo(() => {
    if (isIncomplete) {
      return 'Chưa có hành động nào';
    }
    const items = rule.actions.map((act) => {
      if (act.sceneId || act.action === 'EXECUTE_SCENE') {
        const sc = scenes.find((s) => s.id === act.sceneId);
        return `Chạy ${sc?.name || 'kịch bản'}`;
      }
      const dev = devices.find((d) => d.id === act.deviceId);
      const name = dev?.name || 'thiết bị';
      if (act.action === 'TURN_ON') return `Bật ${name}`;
      if (act.action === 'TURN_OFF') return `Tắt ${name}`;
      if (act.action === 'TOGGLE') return `Đảo ${name}`;
      return `${act.action} ${name}`;
    });
    return `→ ${items.slice(0, 2).join(' · ')}${items.length > 2 ? ` +${items.length - 2}` : ''}`;
  }, [rule, devices, scenes, isIncomplete]);

  return (
    <article
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onEdit?.();
      }}
      className={`scenario-card glass-g1 min-h-[175px] transition-all flex flex-col justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 ${
        rule.enabled ? 'on' : 'off'
      } ${lastRunFailed ? 'failed' : ''}`}
    >
      {/* Top row: 40px icon bubble + Toggle */}
      <div className="scenario-top">
        <span
          className={`scenario-icon w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
            rule.enabled
              ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
              : 'bg-[var(--muted)] text-[var(--secondary)]'
          }`}
        >
          <Icon name={triggerIcon} size={20} />
        </span>

        <button
          type="button"
          disabled={isIncomplete}
          aria-pressed={rule.enabled}
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.(!rule.enabled);
          }}
          className={`toggle ${rule.enabled ? 'active' : ''} ${
            isIncomplete ? 'opacity-40 cursor-not-allowed' : ''
          }`}
          title={isIncomplete ? 'Chưa thể bật · Thiếu hành động' : rule.enabled ? 'Tắt quy tắc' : 'Bật quy tắc'}
        >
          <span />
        </button>
      </div>

      {/* Middle: Title, trigger line, result line */}
      <div className="scenario-copy py-1">
        <h3 className="text-sm font-bold text-[var(--text)] line-clamp-1">
          {rule.name}
        </h3>

        <p className="text-[11px] font-medium text-[var(--secondary)] line-clamp-1 mt-0.5">
          {triggerSummary}
        </p>

        <p className="text-[11px] text-[var(--tertiary)] line-clamp-1 mt-0.5 font-medium">
          {isIncomplete ? (
            <span className="text-amber-600 font-semibold">Chưa hoàn tất · Thiếu hành động</span>
          ) : lastRunFailed ? (
            <span className="text-rose-500 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
              Lần chạy gần nhất lỗi
            </span>
          ) : (
            resultSummary
          )}
        </p>
      </div>

      {/* Bottom row: Counter caption, round 40px test button, ⋯ menu */}
      <div className="scenario-bottom pt-2 border-t border-[var(--border)]">
        <span className="text-[11px] text-[var(--tertiary)] font-medium">
          {rule.conditions.length} điều kiện · {rule.actions.length} hành động
        </span>

        <div className="flex items-center gap-1.5">
          {/* Round 40px "Kiểm tra" button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTest?.();
            }}
            className="w-8 h-8 rounded-full bg-[var(--g1)] hover:bg-[var(--border)] text-[var(--text)] flex items-center justify-center transition-colors cursor-pointer"
            title="Kiểm tra quy tắc (mô phỏng điều kiện)"
            aria-label="Kiểm tra quy tắc"
          >
            <Icon name="test" size={14} />
          </button>

          {/* ⋯ Menu */}
          <div ref={menuRef} className="relative scene-menu-wrap">
            <button
              type="button"
              className="card-affordance w-8 h-8 rounded-full hover:bg-[var(--border)] flex items-center justify-center text-[var(--secondary)] cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
              aria-label="Thao tác khác"
            >
              <Icon name="more" size={16} />
            </button>

            {menuOpen && (
              <div
                className="scene-menu glass-g2 z-30"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit?.();
                  }}
                >
                  <Icon name="pencil" size={13} />
                  <span>Sửa</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onHistory?.();
                  }}
                >
                  <Icon name="clock" size={13} />
                  <span>Xem lịch sử</span>
                </button>

                {isSchedule && onSchedule && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onSchedule();
                    }}
                  >
                    <Icon name="clock" size={13} />
                    <span>Lịch chạy</span>
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
                  <span>Nhân bản</span>
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
                  <span>Xóa quy tắc</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};
