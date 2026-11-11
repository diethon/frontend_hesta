import React from 'react';
import { Icon } from '../home/HomeIcons';
import type { DeviceSummary } from '../../types/automation';
import type { SceneResponse } from '../../types/scene';

export interface SummaryCondition {
  deviceId?: string;
  attribute?: string;
  operator?: string;
  expected?: unknown;
  logicalOperator?: 'AND' | 'OR';
}

export interface SummaryAction {
  deviceId?: string;
  sceneId?: string;
  action?: string;
  value?: unknown;
  parameters?: Record<string, unknown>;
}

export interface SummarySentenceProps {
  triggerType: 'SENSOR' | 'EVENT' | 'SCHEDULE';
  conditions: SummaryCondition[];
  actions: SummaryAction[];
  devices: DeviceSummary[];
  scenes: SceneResponse[];
  scheduleTime?: string;
  scheduleDays?: string;
  globalLogicalOperator?: 'AND' | 'OR';
  className?: string;
}

const operatorLabels: Record<string, string> = {
  EQ: '=',
  NE: '≠',
  GT: '>',
  GTE: '≥',
  LT: '<',
  LTE: '≤',
};

const attributeLabels: Record<string, string> = {
  temperature: 'nhiệt độ',
  humidity: 'độ ẩm',
  motion: 'chuyển động',
  light: 'ánh sáng',
  power: 'công suất',
  state: 'trạng thái',
  eventType: 'sự kiện',
};

const EVENT_FRIENDLY_NAMES: Record<string, string> = {
  DEVICE_STATE_CHANGED: 'thiết bị thay đổi trạng thái',
  SECURITY_ALERT: 'có cảnh báo an ninh',
  SECURITY_EVENT: 'có sự kiện an ninh',
  GAS_LEAK_DETECTED: 'phát hiện rò rỉ khí gas',
  DOOR_OPENED: 'Cửa mở',
  GATE_OPENED: 'Cổng mở',
  MANUAL_OVERRIDE: 'điều khiển thủ công thiết bị',
  MOTION_DETECTED: 'phát hiện chuyển động',
};

const actionLabels: Record<string, string> = {
  TURN_ON: 'Bật',
  TURN_OFF: 'Tắt',
  TOGGLE: 'Đảo trạng thái',
  OPEN: 'Mở',
  CLOSE: 'Đóng',
  STOP: 'Dừng',
  SET_BRIGHTNESS: 'Đặt độ sáng',
  SET_RGB: 'Đổi màu',
  SET_COLOR: 'Đổi màu',
  SET_TEMPERATURE: 'Cài nhiệt độ',
  SET_SPEED: 'Đặt tốc độ',
  EXECUTE_SCENE: 'Chạy kịch bản',
};

export const SummarySentence: React.FC<SummarySentenceProps> = ({
  triggerType,
  conditions,
  actions,
  devices,
  scenes,
  scheduleTime = '07:00',
  scheduleDays = 'hằng ngày',
  globalLogicalOperator = 'AND',
  className = '',
}) => {
  // ── 1. Format Trigger Phrase ──
  let triggerPhrase: React.ReactNode;

  if (triggerType === 'SCHEDULE') {
    const isEveryday = !scheduleDays || scheduleDays.toLowerCase() === 'hằng ngày';
    triggerPhrase = (
      <span>
        {isEveryday ? 'Mỗi ngày' : scheduleDays} lúc{' '}
        <strong className="text-[var(--text)]">{scheduleTime}</strong>
      </span>
    );
  } else if (triggerType === 'EVENT') {
    const firstCond = conditions[0];
    const rawVal = String(firstCond?.expected || firstCond?.attribute || '');
    const friendly = EVENT_FRIENDLY_NAMES[rawVal] || rawVal || 'sự kiện hệ thống';
    const dev = firstCond?.deviceId ? devices.find((d) => d.id === firstCond.deviceId) : undefined;

    triggerPhrase = (
      <span>
        Khi <strong className="text-[var(--text)]">{friendly}</strong>
        {dev && (
          <span>
            {' '}từ <strong className="text-[var(--text)]">{dev.name}</strong>
          </span>
        )}
      </span>
    );
  } else {
    // SENSOR
    if (!conditions.length) {
      triggerPhrase = <span className="text-[var(--tertiary)] italic">…chọn cảm biến…</span>;
    } else {
      const parts = conditions.map((cond, idx) => {
        const dev = devices.find((d) => d.id === cond.deviceId);
        const devName = dev?.name || 'cảm biến';
        const attr = attributeLabels[cond.attribute || ''] || cond.attribute || 'chỉ số';
        const op = operatorLabels[cond.operator || ''] || cond.operator || '>';
        let exp = cond.expected !== undefined && cond.expected !== '' ? String(cond.expected) : '…';
        if (exp === 'true') exp = 'Có';
        else if (exp === 'false') exp = 'Không';

        const joinWord = cond.logicalOperator === 'OR' || globalLogicalOperator === 'OR' ? ' hoặc ' : ' và ';

        return (
          <span key={idx}>
            {idx > 0 && <span className="text-[var(--tertiary)] font-bold">{joinWord}</span>}
            <strong className="text-[var(--text)]">{attr}</strong>{' '}
            <strong className="text-[var(--text)]">{devName}</strong> {op}{' '}
            <strong className="text-[var(--text)]">{exp}</strong>
          </span>
        );
      });
      triggerPhrase = <span>Khi {parts}</span>;
    }
  }

  // ── 2. Format Actions Phrase ──
  let actionsPhrase: React.ReactNode;
  if (!actions.length) {
    actionsPhrase = <span className="text-[var(--tertiary)] italic">…thêm hành động…</span>;
  } else {
    const actionParts = actions.map((act, idx) => {
      const prefix = idx === 0 ? '' : idx === actions.length - 1 ? ', rồi ' : ', ';

      if (act.action === 'EXECUTE_SCENE') {
        const sc = scenes.find((s) => s.id === act.sceneId);
        const scName = sc?.name || 'kịch bản';
        return (
          <span key={idx}>
            {prefix}chạy kịch bản <strong className="text-[var(--text)]">{scName}</strong>
          </span>
        );
      }

      const dev = devices.find((d) => d.id === act.deviceId);
      const devName = dev?.name || 'thiết bị';
      const actLabel = actionLabels[act.action || ''] || act.action || 'điều khiển';

      let paramSummary = '';
      if (act.parameters) {
        if (act.parameters.level !== undefined) paramSummary = ` ${act.parameters.level}%`;
        else if (act.parameters.temperature !== undefined) paramSummary = ` ${act.parameters.temperature}°C`;
        else if (act.parameters.speed !== undefined) paramSummary = ` ${act.parameters.speed}%`;
      }

      return (
        <span key={idx}>
          {prefix}{actLabel} <strong className="text-[var(--text)]">{devName}</strong>
          {paramSummary}
        </span>
      );
    });
    actionsPhrase = <span>thì {actionParts}</span>;
  }

  return (
    <div
      className={`p-3.5 rounded-2xl border border-[var(--border)] glass-g1 flex items-start gap-3 text-xs leading-relaxed ${className}`}
    >
      <span className="w-7 h-7 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5">
        <Icon name="sparkles" size={14} />
      </span>
      <div className="text-[var(--secondary)] flex-1 min-w-0">
        <span className="text-[10px] font-bold text-[var(--tertiary)] uppercase tracking-wider block mb-0.5">
          Tóm tắt quy tắc
        </span>
        <p>
          {triggerPhrase}, {actionsPhrase}.
        </p>
      </div>
    </div>
  );
};
