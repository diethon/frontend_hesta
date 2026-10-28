import React from 'react';
import { Icon, type IconName } from '../home/HomeIcons';

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  triggerType: 'SENSOR' | 'EVENT' | 'SCHEDULE';
  icon: IconName;
  sampleCondition?: {
    attribute: string;
    operator: 'EQ' | 'GT';
    expected: string;
  };
  sampleAction?: {
    action: string;
  };
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'motion-light',
    name: 'Bật đèn khi có chuyển động',
    description: 'Phát hiện có người, tự động bật đèn chiếu sáng',
    triggerType: 'SENSOR',
    icon: 'activity',
    sampleCondition: { attribute: 'motion', operator: 'EQ', expected: 'true' },
    sampleAction: { action: 'TURN_ON' },
  },
  {
    id: 'door-ac',
    name: 'Tắt điều hòa khi có sự kiện mở cửa',
    description: 'Nhận sự kiện mở cửa, tự động tắt điều hòa tiết kiệm điện',
    triggerType: 'EVENT',
    icon: 'door',
    sampleCondition: { attribute: 'eventType', operator: 'EQ', expected: 'EVENT' },
    sampleAction: { action: 'TURN_OFF' },
  },
  {
    id: 'evening-lights',
    name: 'Bật đèn lúc 18:00',
    description: 'Hằng ngày lúc 18:00, tự động bật đèn phòng khách',
    triggerType: 'SCHEDULE',
    icon: 'clock',
    sampleAction: { action: 'TURN_ON' },
  },
];

export interface TemplateGridProps {
  onSelectTemplate: (template: AutomationTemplate) => void;
  onSelectBlank?: () => void;
  className?: string;
}

export const TemplateGrid: React.FC<TemplateGridProps> = ({
  onSelectTemplate,
  onSelectBlank,
  className = '',
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-[var(--text)]">Bắt đầu từ mẫu</h3>
        <p className="text-xs text-[var(--tertiary)]">
          Chọn một mẫu có sẵn hoặc bắt đầu với quy tắc trống
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {AUTOMATION_TEMPLATES.map((tmpl) => (
          <button
            key={tmpl.id}
            type="button"
            onClick={() => onSelectTemplate(tmpl)}
            className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--solid)] hover:bg-[var(--g1)] hover:border-[var(--accent)] text-left transition-all space-y-2 cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Icon name={tmpl.icon} size={18} />
              </span>
              <span className="text-[10px] font-bold text-[var(--tertiary)] uppercase tracking-wider">
                {tmpl.triggerType === 'SENSOR'
                  ? 'Cảm biến'
                  : tmpl.triggerType === 'EVENT'
                  ? 'Sự kiện'
                  : 'Lịch giờ'}
              </span>
            </div>

            <div>
              <strong className="text-xs font-bold text-[var(--text)] block truncate">
                {tmpl.name}
              </strong>
            </div>

            <p className="text-[11px] text-[var(--secondary)] line-clamp-2 leading-relaxed">
              {tmpl.description}
            </p>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={
          onSelectBlank
            ? onSelectBlank
            : () =>
                onSelectTemplate({
                  id: 'blank',
                  name: 'Quy tắc trống',
                  description: 'Tự thiết lập điều kiện và hành động tùy ý',
                  triggerType: 'SENSOR',
                  icon: 'power',
                })
        }
        className="w-full p-3.5 rounded-2xl border border-dashed border-[var(--border)] hover:border-[var(--accent)] bg-[var(--solid)] hover:bg-[var(--g1)] text-left transition-all flex items-center justify-between gap-3 cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-[var(--g1)] text-[var(--secondary)] flex items-center justify-center shrink-0">
            <span className="text-lg font-bold leading-none">+</span>
          </span>
          <div>
            <strong className="text-xs font-semibold text-[var(--text)] block">
              Tạo quy tắc trống
            </strong>
            <span className="text-[11px] text-[var(--tertiary)]">
              Tự thiết lập điều kiện và hành động tùy ý
            </span>
          </div>
        </div>
        <span className="text-xs font-bold text-[var(--accent)] group-hover:translate-x-0.5 transition-transform">
          Bắt đầu →
        </span>
      </button>
    </div>
  );
};
