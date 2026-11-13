import React, { useState, useRef, useEffect } from 'react';
import { Icon, type IconName } from '../ui/LucideIcon';
import type { AutomationRule, DeviceSummary } from '../../types/automation';
import type { SceneResponse } from '../../types/scene';
import { actionLabels, describeCondition, EVENT_FRIENDLY_NAMES } from './ruleLabels';

export interface RuleCardProps {
  rule: AutomationRule;
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

const TRIGGER_ICONS: Record<string, IconName> = { SENSOR: 'activity', EVENT: 'zap', SCHEDULE: 'clock' };

function describeTrigger(rule: AutomationRule, devices: DeviceSummary[]): string {
  if (rule.triggerType === 'SCHEDULE') return 'Tự chạy vào giờ đã hẹn';
  if (rule.triggerType === 'EVENT') {
    const raw = String(rule.conditions[0]?.expectedValue || '');
    const source = devices.find((d) => d.id === rule.conditions[0]?.deviceId)?.name;
    const event = EVENT_FRIENDLY_NAMES[raw] || 'thiết bị báo có sự kiện';
    return `Khi ${event}${source ? ` (${source})` : ''}`;
  }
  const first = rule.conditions[0];
  if (!first) return 'Chưa có điều kiện';
  const device = devices.find((d) => d.id === first.deviceId)?.name;
  const more = rule.conditions.length > 1 ? ` và ${rule.conditions.length - 1} điều kiện khác` : '';
  return `Khi ${describeCondition(first.attribute, first.operator, first.expectedValue, device)}${more}`;
}

function describeActions(rule: AutomationRule, devices: DeviceSummary[], scenes: SceneResponse[]): string {
  const items = rule.actions.map((action) => {
    if (action.sceneId || action.action === 'EXECUTE_SCENE') {
      return `Chạy ${scenes.find((s) => s.id === action.sceneId)?.name || 'kịch bản'}`;
    }
    const device = devices.find((d) => d.id === action.deviceId)?.name || 'thiết bị';
    return `${actionLabels[action.action] || action.action} ${device}`;
  });
  return items.slice(0, 2).join(', ') + (items.length > 2 ? ` +${items.length - 2}` : '');
}

/** One automation rule as a list row: trigger → actions, with toggle and actions menu. */
export const RuleCard: React.FC<RuleCardProps> = ({
  rule,
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
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const isIncomplete = !rule.actions || rule.actions.length === 0;
  const isSchedule = rule.triggerType === 'SCHEDULE';
  const canTest = !isSchedule && !!onTest;

  const menuItem = (label: string, icon: IconName, handler?: () => void, danger = false) => (
    <button
      type="button"
      className={danger ? 'danger' : ''}
      onClick={() => {
        setMenuOpen(false);
        handler?.();
      }}
    >
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onEdit?.()}
      className={`st-rule ${rule.enabled ? '' : 'is-off'}`}
      aria-label={`Quy tắc ${rule.name}`}
    >
      <span className="st-rule-icon">
        <Icon name={TRIGGER_ICONS[rule.triggerType] || 'zap'} />
      </span>

      <div className="st-rule-main">
        <div className="st-rule-title">
          <h4 title={rule.name}>{rule.name}</h4>
          {isIncomplete && <span className="st-tag warn">Thiếu hành động</span>}
          {lastRunFailed && <span className="st-tag err">Lần chạy gần nhất lỗi</span>}
        </div>
        <div className="st-flow">
          <span>{describeTrigger(rule, devices)}</span>
          {!isIncomplete && (
            <>
              <Icon name="chevronDown" />
              <span>
                <b>{describeActions(rule, devices, scenes)}</b>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="st-rule-side" onClick={(e) => e.stopPropagation()}>
        <span className="st-rule-meta">
          {isSchedule ? '' : `${rule.conditions.length} điều kiện · `}
          {rule.actions.length} hành động
        </span>
        {/* Keeps the toggles of all rows aligned when a row has no test button. */}
        {!canTest && <span className="st-icon-btn test" aria-hidden="true" style={{ visibility: 'hidden' }} />}
        {canTest && (
          <button
            type="button"
            className="st-icon-btn test"
            onClick={onTest}
            title="Kiểm tra quy tắc"
            aria-label={`Kiểm tra quy tắc ${rule.name}`}
          >
            <Icon name="test" size={17} />
          </button>
        )}
        <button
          type="button"
          disabled={isIncomplete}
          aria-pressed={rule.enabled}
          aria-label={rule.enabled ? `Tắt quy tắc ${rule.name}` : `Bật quy tắc ${rule.name}`}
          onClick={() => onToggle?.(!rule.enabled)}
          className={`toggle ${rule.enabled ? 'active' : ''} ${isIncomplete ? 'opacity-40 cursor-not-allowed' : ''}`}
          title={isIncomplete ? 'Chưa thể bật · Thiếu hành động' : rule.enabled ? 'Tắt quy tắc' : 'Bật quy tắc'}
        >
          <span />
        </button>
        <div ref={menuRef} className="st-menu-wrap">
          <button
            type="button"
            className="st-icon-btn"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Thao tác khác"
            aria-expanded={menuOpen}
          >
            <Icon name="more" size={18} />
          </button>
          {menuOpen && (
            <div className="st-menu">
              {menuItem('Chỉnh sửa', 'pencil', onEdit)}
              {canTest && menuItem('Kiểm tra', 'test', onTest)}
              {menuItem('Xem lịch sử', 'clock', onHistory)}
              {isSchedule && onSchedule && menuItem('Lịch chạy', 'clock', onSchedule)}
              {menuItem('Nhân bản', 'copy', onDuplicate)}
              <hr />
              {menuItem('Xóa quy tắc', 'trash', onDelete, true)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
