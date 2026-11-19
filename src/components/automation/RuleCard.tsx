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
  onHistory?: () => void;
  onSchedule?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

const TRIGGER_ICONS: Record<string, IconName> = { SENSOR: 'activity', EVENT: 'zap', SCHEDULE: 'clock' };
const TRIGGER_LABELS: Record<string, string> = { SENSOR: 'Cảm biến', EVENT: 'Sự kiện', SCHEDULE: 'Lịch' };

function describeTrigger(rule: AutomationRule, devices: DeviceSummary[]): string {
  if (rule.triggerType === 'SCHEDULE') return 'Tự chạy vào giờ đã hẹn';
  if (rule.triggerType === 'EVENT') {
    const raw = String(rule.conditions[0]?.expectedValue || '');
    const source = devices.find((d) => d.id === rule.conditions[0]?.deviceId)?.name ?? rule.conditions[0]?.deviceName;
    const event = EVENT_FRIENDLY_NAMES[raw] || 'thiết bị báo có sự kiện';
    return `Khi ${event}${source ? ` (${source})` : ''}`;
  }
  const first = rule.conditions[0];
  if (!first) return 'Chưa có điều kiện';
  const device = devices.find((d) => d.id === first.deviceId)?.name ?? first.deviceName;
  const more = rule.conditions.length > 1 ? ` và ${rule.conditions.length - 1} điều kiện khác` : '';
  return `Khi ${describeCondition(first.attribute, first.operator, first.expectedValue, device)}${more}`;
}

function actionNodes(rule: AutomationRule, devices: DeviceSummary[], scenes: SceneResponse[]) {
  return rule.actions.map((action) => {
    if (action.sceneId || action.action === 'EXECUTE_SCENE') {
      const name = scenes.find((s) => s.id === action.sceneId)?.name || action.sceneName || 'kịch bản';
      return { id: action.id, icon: 'sparkles' as IconName, text: `Chạy ${name}` };
    }
    const device = devices.find((d) => d.id === action.deviceId)?.name || action.deviceName || 'thiết bị';
    return { id: action.id, icon: 'power' as IconName, text: `${actionLabels[action.action] || action.action} ${device}` };
  });
}

const MAX_NODES = 3;

/** One automation rule drawn as a circuit: trigger node ── wire ──▶ action nodes. */
export const RuleCard: React.FC<RuleCardProps> = ({
  rule,
  devices = [],
  scenes = [],
  lastRunFailed = false,
  onToggle,
  onEdit,
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

  const nodes = actionNodes(rule, devices, scenes);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onEdit?.()}
      className={`st-circuit ${rule.enabled ? 'is-on' : 'is-off'}`}
      aria-label={`Quy tắc ${rule.name}`}
    >
      <div className="st-circuit-id">
        <h4 title={rule.name}>{rule.name}</h4>
        <span className="st-status">
          <i className={`st-dot ${lastRunFailed ? 'err' : rule.enabled ? 'on' : ''}`} />
          {rule.enabled ? 'Đang bật' : 'Đang tắt'} · {TRIGGER_LABELS[rule.triggerType] || rule.triggerType}
          {isSchedule ? '' : ` · ${rule.conditions.length} điều kiện`}
        </span>
      </div>

      <div className="st-pipe">
        <span className="st-node trigger" title={describeTrigger(rule, devices)}>
          <i className="st-node-icon">
            <Icon name={TRIGGER_ICONS[rule.triggerType] || 'zap'} />
          </i>
          <span>{describeTrigger(rule, devices)}</span>
        </span>
        <span className="st-wire" aria-hidden="true" />
        {isIncomplete ? (
          <span className="st-node missing">Thiếu hành động</span>
        ) : (
          <span className="st-node-stack">
            {nodes.slice(0, MAX_NODES).map((node) => (
              <span key={node.id} className="st-node action" title={node.text}>
                <Icon name={node.icon} />
                <span>{node.text}</span>
              </span>
            ))}
            {nodes.length > MAX_NODES && <span className="st-node more">+{nodes.length - MAX_NODES}</span>}
          </span>
        )}
        {lastRunFailed && <span className="st-tag err">Lần chạy gần nhất lỗi</span>}
      </div>

      <div className="st-circuit-side" onClick={(e) => e.stopPropagation()}>
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
