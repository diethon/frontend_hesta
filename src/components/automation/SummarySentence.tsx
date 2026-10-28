import React from 'react';
import { Icon } from '../home/HomeIcons';
import type { DeviceSummary } from '../../types/automation';
import type { SceneResponse } from '../../types/scene';

export interface SummaryCondition {
  deviceId?: string;
  attribute?: string;
  operator?: string;
  expected?: string;
}

export interface SummaryAction {
  deviceId?: string;
  sceneId?: string;
  action?: string;
  value?: string;
}

export interface SummarySentenceProps {
  triggerType: 'SENSOR' | 'EVENT' | 'SCHEDULE';
  conditions: SummaryCondition[];
  actions: SummaryAction[];
  devices: DeviceSummary[];
  scenes: SceneResponse[];
  scheduleTime?: string;
  scheduleDays?: string;
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
  power: 'nguồn điện',
  state: 'trạng thái',
  eventType: 'sự kiện',
};

const actionLabels: Record<string, string> = {
  TURN_ON: 'Bật',
  TURN_OFF: 'Tắt',
  TOGGLE: 'Đảo trạng thái',
  OPEN: 'Mở',
  CLOSE: 'Đóng',
  STOP: 'Dừng',
  SET_BRIGHTNESS: 'Độ sáng',
  SET_RGB: 'Đổi màu',
  SET_COLOR: 'Đổi màu',
  SET_TEMPERATURE: 'Cài nhiệt độ',
  SET_SPEED: 'Tốc độ quạt',
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
  className = '',
}) => {
  // Format trigger clause
  let triggerPhrase: React.ReactNode = null;

  if (triggerType === 'SCHEDULE') {
    triggerPhrase = (
      <span>
        Vào lúc <strong className="text-[var(--text)]">{scheduleTime}</strong> ({scheduleDays})
      </span>
    );
  } else if (triggerType === 'EVENT') {
    const firstCond = conditions[0];
    const eventName = firstCond?.expected || firstCond?.attribute || 'sự kiện hệ thống';
    triggerPhrase = (
      <span>
        Khi xảy ra sự kiện <strong className="text-[var(--text)]">{eventName}</strong>
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
        const exp = cond.expected !== undefined && cond.expected !== '' ? cond.expected : '…';

        return (
          <span key={idx}>
            {idx > 0 && <span className="text-[var(--tertiary)]"> và </span>}
            <strong className="text-[var(--text)]">{attr}</strong> của{' '}
            <strong className="text-[var(--text)]">{devName}</strong> {op}{' '}
            <strong className="text-[var(--text)]">{exp}</strong>
          </span>
        );
      });
      triggerPhrase = <span>Khi {parts}</span>;
    }
  }

  // Format actions clause
  let actionsPhrase: React.ReactNode = null;
  if (!actions.length) {
    actionsPhrase = <span className="text-[var(--tertiary)] italic">…thêm hành động…</span>;
  } else {
    const actionParts = actions.map((act, idx) => {
      if (act.action === 'EXECUTE_SCENE') {
        const sc = scenes.find((s) => s.id === act.sceneId);
        const scName = sc?.name || 'kịch bản';
        return (
          <span key={idx}>
            {idx > 0 && <span className="text-[var(--tertiary)]">, </span>}
            chạy kịch bản <strong className="text-[var(--text)]">{scName}</strong>
          </span>
        );
      }
      const dev = devices.find((d) => d.id === act.deviceId);
      const devName = dev?.name || 'thiết bị';
      const actLabel = actionLabels[act.action || ''] || act.action || 'điều khiển';
      const extraVal = act.value ? ` ${act.value}` : '';

      return (
        <span key={idx}>
          {idx > 0 && <span className="text-[var(--tertiary)]">, </span>}
          {actLabel} <strong className="text-[var(--text)]">{devName}</strong>
          {extraVal}
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
