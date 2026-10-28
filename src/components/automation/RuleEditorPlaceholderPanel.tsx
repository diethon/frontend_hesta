import React from 'react';
import { Icon } from '../home/HomeIcons';
import type { AutomationRule, DeviceSummary } from '../../types/automation';
import type { SceneResponse } from '../../types/scene';
import { SummarySentence } from './SummarySentence';
import { TemplateGrid, type AutomationTemplate } from './TemplateGrid';

export interface RuleEditorPlaceholderPanelProps {
  rule?: AutomationRule | null;
  isOpen: boolean;
  onClose: () => void;
  devices: DeviceSummary[];
  scenes: SceneResponse[];
  onSelectTemplate?: (template: AutomationTemplate) => void;
}

export const RuleEditorPlaceholderPanel: React.FC<RuleEditorPlaceholderPanelProps> = ({
  rule,
  isOpen,
  onClose,
  devices,
  scenes,
  onSelectTemplate,
}) => {
  if (!isOpen) return null;

  const isNew = !rule;
  const title = rule?.name || 'Quy tắc mới';
  const caption = isNew
    ? 'Tạo quy tắc mới'
    : `${rule.triggerType === 'SENSOR' ? 'Cảm biến' : rule.triggerType === 'SCHEDULE' ? 'Lịch giờ' : 'Sự kiện'} · ${
        rule.enabled ? 'Đang bật' : 'Đang tắt'
      }`;

  return (
    <div className="scene-layer">
      <button
        type="button"
        className="detail-scrim"
        onClick={onClose}
        aria-label="Đóng bảng chỉnh sửa"
      />

      <aside className="scene-panel scene-editor-panel glass-g2">
        <div className="sheet-handle" />

        {/* Sticky Header */}
        <header className="scene-panel-header scene-editor-header">
          <button
            type="button"
            className="detail-icon-button"
            onClick={onClose}
            aria-label="Đóng"
          >
            <Icon name="chevronDown" size={18} />
          </button>

          <div className="min-w-0 flex-1">
            <strong className="text-sm font-bold text-[var(--text)] block truncate">
              {title}
            </strong>
            <small className="text-[11px] text-[var(--tertiary)] block truncate">
              {caption}
            </small>
          </div>

          <button
            type="button"
            className={`toggle ${rule?.enabled ? 'active' : ''}`}
            aria-pressed={rule?.enabled}
            disabled={isNew}
          >
            <span />
          </button>
        </header>

        {/* Panel Content */}
        <div className="scene-panel-scroll p-5 space-y-5">
          {/* Live Summary Sentence */}
          <SummarySentence
            triggerType={rule?.triggerType || 'SENSOR'}
            conditions={rule?.conditions || []}
            actions={rule?.actions || []}
            devices={devices}
            scenes={scenes}
          />

          {isNew ? (
            <TemplateGrid
              onSelectTemplate={(tmpl) => onSelectTemplate?.(tmpl)}
              onSelectBlank={() => {}}
            />
          ) : (
            <div className="p-6 rounded-3xl border border-[var(--border)] glass-g1 text-center space-y-3 my-4">
              <span className="w-12 h-12 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center mx-auto">
                <Icon name="sparkles" size={24} />
              </span>
              <div>
                <strong className="text-sm font-bold text-[var(--text)] block">
                  Trình chỉnh sửa quy tắc tự động
                </strong>
                <p className="text-xs text-[var(--tertiary)] mt-1 max-w-xs mx-auto leading-relaxed">
                  Giao diện thiết lập chi tiết (Thông tin, Khi nào, Thì làm gì) sẽ được hoàn thiện trong Phase 3.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <footer className="scene-editor-footer flex items-center justify-end gap-2.5 p-4 border-t border-[var(--border)] bg-[var(--solid)]">
          <button
            type="button"
            className="px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--g1)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--border)] transition-colors cursor-pointer"
            onClick={onClose}
          >
            Đóng
          </button>
          <button
            type="button"
            className="px-5 py-2 rounded-full bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
            onClick={onClose}
          >
            {isNew ? 'Tạo quy tắc' : 'Lưu quy tắc'}
          </button>
        </footer>
      </aside>
    </div>
  );
};
