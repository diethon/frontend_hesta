import React, { useState, useEffect, useMemo, useRef } from 'react';
import type {
  AutomationRule,
  AutomationRuleInput,
  DeviceSummary,
  RuleConditionInput,
  RuleActionInput,
} from '../../types/automation';
import type { SceneResponse } from '../../types/scene';
import type { Schedule } from '../../types/schedule';
import { Icon, type IconName } from '../home/HomeIcons';
import { TemplateGrid, type AutomationTemplate } from './TemplateGrid';
import { SummarySentence } from './SummarySentence';
import { PickerField } from './PickerField';
import { ConditionCard } from './ConditionCard';
import { ActionStepCard } from './ActionStepCard';
import { SplitButton } from './SplitButton';
import { EventPickerSheet } from './EventPickerSheet';
import { ScenePickerSheet } from './ScenePickerSheet';
import { DevicePickerSheet } from '../scene/DevicePickerSheet';
import { SceneScheduleSection, formatRepeatDays } from '../scene/SceneScheduleSection';
import { ConfirmModal } from '../ui/ConfirmModal';
import { createAutomationRule, updateAutomationRule, deleteAutomationRule } from '../../services/automationApi';
import { saveSchedule } from '../../services/scheduleApi';
import { notify } from '../ui/notify';
import { RuleHistoryPanel } from './RuleHistoryPanel';
import { RuleTestSheet } from './RuleTestSheet';

export interface RuleEditorPanelProps {
  rule?: AutomationRule | null; // null = create mode, AutomationRule = edit mode, undefined = closed
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  devices: DeviceSummary[];
  scenes: SceneResponse[];
  homeId: string;
  onDuplicate?: (rule: AutomationRule) => void;
  initialScrollToTrigger?: boolean;
}

export const RuleEditorPanel: React.FC<RuleEditorPanelProps> = ({
  rule,
  isOpen,
  onClose,
  onSaved,
  devices,
  scenes,
  homeId,
  onDuplicate,
  initialScrollToTrigger = false,
}) => {
  const isEdit = Boolean(rule && rule.id);

  // ── Tab State [Thiết lập | Lịch sử] ──
  const [activeTab, setActiveTab] = useState<'setup' | 'history'>('setup');
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [testSheetOpen, setTestSheetOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const triggerSectionRef = useRef<HTMLElement>(null);

  // ── Step 0: Create Mode Starts from TemplateGrid ──
  const [showTemplateGrid, setShowTemplateGrid] = useState(!isEdit);

  // ── Form State ──
  const [currentRuleId, setCurrentRuleId] = useState<string | null>(rule?.id || null);
  const [name, setName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [description, setDescription] = useState('');
  const [descExpanded, setDescExpanded] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [triggerType, setTriggerType] = useState<'SENSOR' | 'EVENT' | 'SCHEDULE'>('SENSOR');

  // Conditions (for SENSOR or EVENT)
  const [conditions, setConditions] = useState<RuleConditionInput[]>([]);
  const [expandedCondIndex, setExpandedCondIndex] = useState<number | null>(0);
  const [globalLogicalOp, setGlobalLogicalOp] = useState<'AND' | 'OR'>('AND');
  const [hasLegacyMixedOp, setHasLegacyMixedOp] = useState(false);

  // Actions
  const [actions, setActions] = useState<RuleActionInput[]>([]);
  const [expandedActIndex, setExpandedActIndex] = useState<number | null>(0);

  // Schedules (for SCHEDULE trigger)
  const [draftSchedules, setDraftSchedules] = useState<Schedule[]>([]);

  // Dirty state tracking
  const [isDirty, setIsDirty] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmOverwriteOpOpen, setConfirmOverwriteOpOpen] = useState(false);
  const [pendingLogicalOp, setPendingLogicalOp] = useState<'AND' | 'OR'>('AND');

  // Saving states & partial-failure banner
  const [saving, setSaving] = useState(false);
  const [scheduleSaveError, setScheduleSaveError] = useState<string | null>(null);

  // Sub-sheet states
  const [devicePickerMode, setDevicePickerMode] = useState<
    { open: true; target: 'condition' | 'action' | 'eventSource'; index?: number } | { open: false }
  >({ open: false });
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [scenePickerIndex, setScenePickerIndex] = useState<number | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── Initialize or reset when rule changes ──
  useEffect(() => {
    if (!isOpen) return;

    if (rule && rule.id) {
      setCurrentRuleId(rule.id);
      setShowTemplateGrid(false);
      setName(rule.name || '');
      setDescription(rule.description || '');
      setDescExpanded(Boolean(rule.description));
      setEnabled(rule.enabled ?? true);
      setTriggerType(rule.triggerType || 'SENSOR');

      // Check conditions
      const conds = (rule.conditions || []).map((c, idx) => ({
        deviceId: c.deviceId,
        attribute: c.attribute,
        operator: c.operator,
        expectedValue: c.expectedValue,
        logicalOperator: c.logicalOperator || 'AND',
        order: idx,
      }));
      setConditions(conds);
      setExpandedCondIndex(conds.length > 0 ? 0 : null);

      // Check legacy mixed operators
      if (conds.length >= 2) {
        const ops = new Set(conds.map((c) => c.logicalOperator));
        if (ops.size > 1) {
          setHasLegacyMixedOp(true);
        } else {
          setHasLegacyMixedOp(false);
          setGlobalLogicalOp((conds[0]?.logicalOperator as 'AND' | 'OR') || 'AND');
        }
      }

      // Actions
      const acts = (rule.actions || []).map((a, idx) => ({
        deviceId: a.deviceId,
        sceneId: a.sceneId,
        action: a.action,
        parameters: a.parameters || {},
        order: idx,
      }));
      setActions(acts);
      setExpandedActIndex(acts.length > 0 ? 0 : null);

      setIsDirty(false);
      setScheduleSaveError(null);
    } else {
      // Create mode
      setCurrentRuleId(null);
      setShowTemplateGrid(true);
      setName('');
      setDescription('');
      setDescExpanded(false);
      setEnabled(true);
      setTriggerType('SENSOR');
      setConditions([]);
      setActions([]);
      setDraftSchedules([]);
      setExpandedCondIndex(null);
      setExpandedActIndex(null);
      setHasLegacyMixedOp(false);
      setGlobalLogicalOp('AND');
      setIsDirty(false);
      setScheduleSaveError(null);
    }
  }, [rule, isOpen]);

  // Click outside for header ⋯ menu
  useEffect(() => {
    if (!headerMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [headerMenuOpen]);

  // Auto-scroll to trigger section if initialScrollToTrigger is requested
  useEffect(() => {
    if (isOpen && initialScrollToTrigger && triggerSectionRef.current) {
      const timer = setTimeout(() => {
        triggerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialScrollToTrigger]);

  // Mark dirty
  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };

  // ── Template selection ──
  const handleSelectTemplate = (tmpl: AutomationTemplate) => {
    setShowTemplateGrid(false);
    markDirty();

    if (tmpl.id === 'blank') {
      setName('');
      setTriggerType('SENSOR');
      setConditions([]);
      setActions([]);
      return;
    }

    setName(tmpl.name);
    setTriggerType(tmpl.triggerType);

    if (tmpl.triggerType === 'SENSOR') {
      setConditions([
        {
          attribute: 'motion',
          operator: 'EQ',
          expectedValue: true,
          logicalOperator: 'AND',
          order: 0,
        },
      ]);
      setActions([
        {
          action: 'TURN_ON',
          parameters: {},
          order: 0,
        },
      ]);
      setExpandedCondIndex(0);
      setExpandedActIndex(0);
    } else if (tmpl.triggerType === 'EVENT') {
      const eventCode = tmpl.sampleCondition?.expected || (tmpl.id === 'door-ac' ? 'DOOR_OPENED' : 'GAS_LEAK_DETECTED');
      const actCode = tmpl.sampleAction?.action || (tmpl.id === 'door-ac' ? 'TURN_OFF' : 'TURN_ON');
      setConditions([
        {
          attribute: 'eventType',
          operator: 'EQ',
          expectedValue: eventCode,
          logicalOperator: 'AND',
          order: 0,
        },
      ]);
      setActions([
        {
          action: actCode,
          parameters: {},
          order: 0,
        },
      ]);
      setExpandedCondIndex(0);
      setExpandedActIndex(0);
    } else if (tmpl.triggerType === 'SCHEDULE') {
      setConditions([]);
      setActions([
        {
          action: 'TURN_ON',
          parameters: {},
          order: 0,
        },
      ]);
      setExpandedActIndex(0);
    }
  };

  // ── Derived Icon ──
  const triggerIconName: IconName = useMemo(() => {
    if (triggerType === 'SENSOR') return 'activity';
    if (triggerType === 'EVENT') return 'zap';
    return 'clock';
  }, [triggerType]);

  // ── Header caption ──
  const headerCaption = useMemo(() => {
    if (!currentRuleId) return 'Quy tắc mới';
    const typeLabel =
      triggerType === 'SENSOR'
        ? 'Cảm biến'
        : triggerType === 'EVENT'
        ? 'Sự kiện'
        : 'Lịch giờ';
    return `${typeLabel} · ${enabled ? 'Đang bật' : 'Đang tắt'}`;
  }, [currentRuleId, triggerType, enabled]);

  // ── Validation Reason ──
  const validationError = useMemo(() => {
    if (!name.trim()) return 'Nhập tên quy tắc (tối đa 40 ký tự)';
    if (triggerType === 'SENSOR') {
      if (conditions.length === 0) return 'Thêm ít nhất 1 điều kiện cho cảm biến';
      const incomplete = conditions.find((c) => !c.deviceId);
      if (incomplete) return 'Chọn cảm biến nguồn cho điều kiện';
    }
    if (triggerType === 'EVENT') {
      const first = conditions[0];
      if (!first || !first.expectedValue) return 'Chọn sự kiện kích hoạt';
    }
    if (actions.length === 0) return 'Thêm ít nhất 1 hành động thực thi';
    const incompleteAction = actions.find((a) => {
      if (a.action === 'EXECUTE_SCENE') return !a.sceneId;
      return !a.deviceId;
    });
    if (incompleteAction) return 'Chọn thiết bị hoặc kịch bản cho hành động';
    return null;
  }, [name, triggerType, conditions, actions]);

  const isValid = validationError === null;

  // ── Close handler with unsaved changes confirmation ──
  const handleRequestClose = () => {
    if (isDirty) {
      setConfirmCloseOpen(true);
    } else {
      onClose();
    }
  };

  // ── SENSOR Conditions Logic ──
  const handleAddCondition = () => {
    markDirty();
    const newCond: RuleConditionInput = {
      attribute: 'temperature',
      operator: 'GT',
      expectedValue: 30,
      logicalOperator: globalLogicalOp,
      order: conditions.length,
    };
    const next = [...conditions, newCond];
    setConditions(next);
    setExpandedCondIndex(next.length - 1);
  };

  const handleUpdateCondition = (index: number, updated: RuleConditionInput) => {
    markDirty();
    setConditions((prev) => prev.map((c, i) => (i === index ? updated : c)));
  };

  const handleDeleteCondition = (index: number) => {
    markDirty();
    setConditions((prev) =>
      prev.filter((_, i) => i !== index).map((c, i) => ({ ...c, order: i }))
    );
    if (expandedCondIndex === index) setExpandedCondIndex(null);
  };

  const handleDuplicateCondition = (index: number) => {
    markDirty();
    const source = conditions[index];
    if (!source) return;
    const duplicated: RuleConditionInput = {
      ...source,
      order: conditions.length,
    };
    setConditions((prev) => [...prev, duplicated]);
    setExpandedCondIndex(conditions.length);
  };

  // Switch Logical Operator (AND/OR)
  const handleSwitchLogicalOp = (op: 'AND' | 'OR') => {
    if (hasLegacyMixedOp) {
      setPendingLogicalOp(op);
      setConfirmOverwriteOpOpen(true);
      return;
    }
    markDirty();
    setGlobalLogicalOp(op);
    setConditions((prev) => prev.map((c) => ({ ...c, logicalOperator: op })));
  };

  const handleConfirmOverwriteMixedOp = () => {
    markDirty();
    setHasLegacyMixedOp(false);
    setGlobalLogicalOp(pendingLogicalOp);
    setConditions((prev) => prev.map((c) => ({ ...c, logicalOperator: pendingLogicalOp })));
    setConfirmOverwriteOpOpen(false);
  };

  // ── Actions Logic ──
  const handleAddDeviceAction = () => {
    markDirty();
    const newAct: RuleActionInput = {
      action: 'TURN_ON',
      parameters: {},
      order: actions.length,
    };
    const next = [...actions, newAct];
    setActions(next);
    setExpandedActIndex(next.length - 1);
  };

  const handleAddSceneAction = () => {
    markDirty();
    const newAct: RuleActionInput = {
      action: 'EXECUTE_SCENE',
      parameters: {},
      order: actions.length,
    };
    const next = [...actions, newAct];
    setActions(next);
    setExpandedActIndex(next.length - 1);
  };

  const handleUpdateAction = (index: number, updated: RuleActionInput) => {
    markDirty();
    setActions((prev) => prev.map((a, i) => (i === index ? updated : a)));
  };

  const handleDeleteAction = (index: number) => {
    markDirty();
    setActions((prev) =>
      prev.filter((_, i) => i !== index).map((a, i) => ({ ...a, order: i }))
    );
    if (expandedActIndex === index) setExpandedActIndex(null);
  };

  const handleDuplicateAction = (index: number) => {
    markDirty();
    const src = actions[index];
    if (!src) return;
    const dup: RuleActionInput = {
      ...src,
      order: actions.length,
    };
    setActions((prev) => [...prev, dup]);
    setExpandedActIndex(actions.length);
  };

  const handleMoveAction = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= actions.length) return;
    markDirty();
    const copy = [...actions];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    setActions(copy.map((a, i) => ({ ...a, order: i })));
    setExpandedActIndex(targetIdx);
  };

  // ── Save Flow ──
  const handleSaveRule = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    setScheduleSaveError(null);

    const payload: AutomationRuleInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      triggerType,
      enabled,
      conditions: triggerType === 'SCHEDULE' ? [] : conditions,
      actions,
    };

    try {
      let savedRuleId = currentRuleId;

      if (!currentRuleId) {
        // Create mode
        const created = await createAutomationRule(homeId, payload);
        savedRuleId = created.id;
        setCurrentRuleId(created.id);
      } else {
        // Edit mode
        await updateAutomationRule(homeId, currentRuleId, payload);
      }

      // If SCHEDULE rule, save schedules
      if (triggerType === 'SCHEDULE' && savedRuleId) {
        if (draftSchedules.length > 0) {
          try {
            for (const s of draftSchedules) {
              if (s.id && s.id.startsWith('temp_')) {
                await saveSchedule(homeId, 'automation-rules', savedRuleId, {
                  scheduledTime: s.scheduledTime,
                  repeatDays: s.repeatDays || [],
                  active: s.active,
                });
              }
            }
          } catch (schedErr) {
            console.error('Schedule save error:', schedErr);
            setScheduleSaveError(
              'Quy tắc đã được tạo nhưng chưa lưu được lịch hẹn giờ.'
            );
            notify.error('Không thể lưu lịch hẹn giờ');
            setSaving(false);
            onSaved();
            return;
          }
        }
      }

      notify.success(currentRuleId ? 'Đã cập nhật quy tắc' : 'Đã tạo quy tắc thành công');
      setIsDirty(false);
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể lưu quy tắc';
      notify.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Retry Schedule Save in partial failure
  const handleRetryScheduleSave = async () => {
    if (!currentRuleId || !homeId) return;
    setSaving(true);
    try {
      for (const s of draftSchedules) {
        await saveSchedule(homeId, 'automation-rules', currentRuleId, {
          scheduledTime: s.scheduledTime,
          repeatDays: s.repeatDays || [],
          active: s.active,
        });
      }
      setScheduleSaveError(null);
      notify.success('Đã lưu lịch thành công');
      onSaved();
    } catch {
      notify.error('Lưu lịch thất bại · Vui lòng thử lại');
    } finally {
      setSaving(false);
    }
  };

  // Delete Rule
  const handleDeleteRule = async () => {
    if (!currentRuleId) return;
    try {
      await deleteAutomationRule(homeId, currentRuleId);
      notify.success('Đã xóa quy tắc');
      setConfirmDeleteOpen(false);
      onSaved();
      onClose();
    } catch {
      notify.error('Không thể xóa quy tắc');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="scene-panel-backdrop active" onClick={handleRequestClose} />

      <aside
        className="scene-panel glass-g2 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rule-editor-title"
      >
        {/* ── Sticky Header ── */}
        <header className="scene-panel-header shrink-0 flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <button
              type="button"
              onClick={handleRequestClose}
              className="icon-button w-8 h-8 rounded-full hover:bg-[var(--border)] flex items-center justify-center text-[var(--secondary)] cursor-pointer"
              aria-label="Đóng"
            >
              <Icon name="x" size={16} />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
                  <Icon name={triggerIconName} size={13} />
                </span>

                {isEditingName ? (
                  <input
                    ref={nameInputRef}
                    autoFocus
                    value={name}
                    maxLength={40}
                    onChange={(e) => {
                      setName(e.target.value);
                      markDirty();
                    }}
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setIsEditingName(false);
                    }}
                    placeholder="Tên quy tắc"
                    className="text-sm font-bold text-[var(--text)] bg-transparent border-b border-[var(--accent)] focus:outline-none max-w-[200px]"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingName(true)}
                    className="group flex items-center gap-1.5 text-left cursor-pointer"
                  >
                    <strong
                      id="rule-editor-title"
                      className="text-sm font-bold text-[var(--text)] truncate max-w-[200px]"
                    >
                      {name || <span className="text-[var(--tertiary)] italic">Tên quy tắc</span>}
                    </strong>
                    <Icon
                      name="pencil"
                      size={12}
                      className="text-[var(--tertiary)] group-hover:text-[var(--text)] transition-colors shrink-0"
                    />
                  </button>
                )}
              </div>

              <span className="text-[11px] text-[var(--secondary)] block truncate mt-0.5">
                {headerCaption}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle Kích hoạt */}
            <button
              type="button"
              onClick={() => {
                setEnabled((prev) => !prev);
                markDirty();
              }}
              className={`device-toggle-pill scale-85 cursor-pointer ${enabled ? 'active' : ''}`}
              title={enabled ? 'Đang bật · Nhấn để tắt' : 'Đang tắt · Nhấn để bật'}
              aria-label="Kích hoạt quy tắc"
            >
              <span />
            </button>

            {/* ⋯ Menu */}
            {currentRuleId && (
              <div ref={headerMenuRef} className="relative scene-menu-wrap">
                <button
                  type="button"
                  onClick={() => setHeaderMenuOpen((prev) => !prev)}
                  className="card-affordance w-8 h-8 rounded-full hover:bg-[var(--border)] flex items-center justify-center text-[var(--secondary)] cursor-pointer"
                  title="Thao tác khác"
                  aria-label="Thao tác khác"
                >
                  <Icon name="more" size={16} />
                </button>

                {headerMenuOpen && (
                  <div
                    className="scene-menu glass-g2 z-30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onDuplicate && rule && (
                      <button
                        type="button"
                        onClick={() => {
                          setHeaderMenuOpen(false);
                          onDuplicate(rule);
                        }}
                      >
                        <Icon name="copy" size={13} />
                        <span>Nhân bản</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        setConfirmDeleteOpen(true);
                      }}
                    >
                      <Icon name="trash" size={13} />
                      <span>Xóa quy tắc</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* ── Segmented Control [Thiết lập | Lịch sử] for saved rules ── */}
        {currentRuleId && (
          <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--solid)] shrink-0">
            <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-[var(--muted)] border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setActiveTab('setup')}
                className={`py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'setup'
                    ? 'bg-[var(--solid)] text-[var(--text)] shadow-xs'
                    : 'text-[var(--secondary)] hover:text-[var(--text)]'
                }`}
              >
                Thiết lập
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-[var(--solid)] text-[var(--text)] shadow-xs'
                    : 'text-[var(--secondary)] hover:text-[var(--text)]'
                }`}
              >
                Lịch sử
              </button>
            </div>
          </div>
        )}

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {activeTab === 'history' && rule ? (
            <RuleHistoryPanel
              isInline
              homeId={homeId}
              rule={rule}
              devices={devices}
              scenes={scenes}
            />
          ) : (
            <>
          {/* Partial-failure banner for SCHEDULE */}
          {scheduleSaveError && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-700">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <Icon name="alert" size={16} className="shrink-0 text-amber-600" />
                <span className="truncate">{scheduleSaveError}</span>
              </div>
              <button
                type="button"
                onClick={handleRetryScheduleSave}
                disabled={saving}
                className="px-3 py-1 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : 'Thử lưu lịch'}
              </button>
            </div>
          )}

          {/* Create Mode: Step 0 TemplateGrid */}
          {showTemplateGrid && !currentRuleId ? (
            <div className="space-y-4">
              <TemplateGrid onSelectTemplate={handleSelectTemplate} />
            </div>
          ) : (
            <>
              {/* Section 0: Live SummarySentence Card */}
              <SummarySentence
                triggerType={triggerType}
                conditions={conditions.map((c) => ({
                  deviceId: c.deviceId,
                  attribute: c.attribute,
                  operator: c.operator,
                  expected: c.expectedValue,
                  logicalOperator: c.logicalOperator,
                }))}
                actions={actions.map((a) => ({
                  deviceId: a.deviceId,
                  sceneId: a.sceneId,
                  action: a.action,
                  parameters: a.parameters,
                }))}
                devices={devices}
                scenes={scenes}
                scheduleTime={draftSchedules[0]?.scheduledTime || '07:00'}
                scheduleDays={formatRepeatDays(draftSchedules[0]?.repeatDays || [])}
                globalLogicalOperator={globalLogicalOp}
              />

              {/* ── Section 1: Thông tin ── */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                    1. Thông tin quy tắc
                  </span>
                  <span className="text-[11px] font-mono text-[var(--tertiary)]">
                    {name.length}/40
                  </span>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    maxLength={40}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      markDirty();
                    }}
                    placeholder="Nhập tên quy tắc (vd: Bật đèn khi về nhà)..."
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-[var(--border)] bg-[var(--solid)] text-xs font-medium text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                  />

                  {descExpanded ? (
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        markDirty();
                      }}
                      placeholder="Mô tả mục đích hoặc ghi chú cho quy tắc này..."
                      className="w-full px-3.5 py-2 rounded-2xl border border-[var(--border)] bg-[var(--solid)] text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDescExpanded(true)}
                      className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <span>+ Thêm mô tả</span>
                    </button>
                  )}
                </div>
              </section>

              {/* ── Section 2: Khi nào (Trigger) ── */}
              <section ref={triggerSectionRef} className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                    2. Khi nào (Kích hoạt)
                  </span>

                  {/* Trigger Type Segmented Control */}
                  {isEdit ? (
                    <span
                      className="text-[10px] text-[var(--tertiary)] italic"
                      title="Không thể đổi loại kích hoạt sau khi tạo. Hãy tạo quy tắc mới."
                    >
                      Không thể đổi loại sau khi tạo
                    </span>
                  ) : null}
                </div>

                {/* Segmented Control */}
                <div
                  className={`grid grid-cols-3 gap-1 bg-[var(--solid)] p-1 rounded-2xl border border-[var(--border)] ${
                    isEdit ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  {[
                    { id: 'SENSOR', label: 'Cảm biến', icon: 'activity' as IconName },
                    { id: 'EVENT', label: 'Sự kiện', icon: 'zap' as IconName },
                    { id: 'SCHEDULE', label: 'Lịch giờ', icon: 'clock' as IconName },
                  ].map((tab) => {
                    const isSelected = triggerType === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        disabled={isEdit}
                        onClick={() => {
                          if (isEdit) return;
                          setTriggerType(tab.id as typeof triggerType);
                          markDirty();
                          if (tab.id === 'EVENT' && conditions.length === 0) {
                            setConditions([
                              {
                                attribute: 'eventType',
                                operator: 'EQ',
                                expectedValue: 'MOTION_DETECTED',
                                logicalOperator: 'AND',
                                order: 0,
                              },
                            ]);
                          } else if (tab.id === 'SCHEDULE') {
                            setConditions([]);
                          }
                        }}
                        className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'bg-[var(--accent)] text-white shadow-xs'
                            : 'text-[var(--secondary)] hover:text-[var(--text)]'
                        } ${isEdit ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <Icon name={tab.icon} size={14} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* ── Sub-view SENSOR ── */}
                {triggerType === 'SENSOR' && (
                  <div className="space-y-3">
                    {/* AND/OR Segmented Control when 2+ conditions */}
                    {conditions.length >= 2 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[var(--secondary)]">
                          Điều kiện kết hợp:
                        </span>
                        <div className="flex items-center gap-1 bg-[var(--solid)] p-0.5 rounded-xl border border-[var(--border)]">
                          <button
                            type="button"
                            onClick={() => handleSwitchLogicalOp('AND')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              globalLogicalOp === 'AND' && !hasLegacyMixedOp
                                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                                : 'text-[var(--secondary)] hover:text-[var(--text)]'
                            }`}
                          >
                            Tất cả điều kiện (VÀ)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSwitchLogicalOp('OR')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              globalLogicalOp === 'OR' && !hasLegacyMixedOp
                                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                                : 'text-[var(--secondary)] hover:text-[var(--text)]'
                            }`}
                          >
                            Bất kỳ điều kiện (HOẶC)
                          </button>
                        </div>
                      </div>
                    )}

                    {hasLegacyMixedOp && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
                        Quy tắc dùng điều kiện kết hợp nâng cao. Chọn lại VÀ/HOẶC sẽ áp dụng đồng nhất.
                      </div>
                    )}

                    {/* Condition Cards */}
                    <div className="space-y-2">
                      {conditions.map((cond, idx) => (
                        <ConditionCard
                          key={idx}
                          condition={cond}
                          index={idx}
                          devices={devices}
                          isExpanded={expandedCondIndex === idx}
                          onToggleExpand={() =>
                            setExpandedCondIndex((cur) => (cur === idx ? null : idx))
                          }
                          onChange={(updated) => handleUpdateCondition(idx, updated)}
                          onDuplicate={() => handleDuplicateCondition(idx)}
                          onDelete={() => handleDeleteCondition(idx)}
                          onPickDevice={() =>
                            setDevicePickerMode({
                              open: true,
                              target: 'condition',
                              index: idx,
                            })
                          }
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleAddCondition}
                      className="w-full py-2.5 rounded-2xl border border-dashed border-[var(--border)] text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Icon name="plus" size={14} />
                      <span>+ Thêm điều kiện cảm biến</span>
                    </button>
                  </div>
                )}

                {/* ── Sub-view EVENT ── */}
                {triggerType === 'EVENT' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                        Sự kiện hệ thống
                      </label>
                      <PickerField
                        label={
                          String(conditions[0]?.expectedValue || '') || 'Chọn sự kiện'
                        }
                        caption={
                          conditions[0]?.expectedValue
                            ? 'Sự kiện hệ thống được theo dõi'
                            : 'Nhấn để chọn sự kiện kích hoạt'
                        }
                        icon="zap"
                        hasError={!conditions[0]?.expectedValue}
                        onClick={() => setEventPickerOpen(true)}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                          Chỉ khi từ thiết bị (tùy chọn)
                        </label>
                        {conditions[0]?.deviceId && (
                          <button
                            type="button"
                            onClick={() => {
                              markDirty();
                              setConditions((prev) => [
                                { ...prev[0], deviceId: undefined },
                              ]);
                            }}
                            className="text-[11px] text-rose-500 hover:underline cursor-pointer"
                          >
                            Xóa chọn thiết bị
                          </button>
                        )}
                      </div>

                      <PickerField
                        label={
                          conditions[0]?.deviceId
                            ? devices.find((d) => d.id === conditions[0]?.deviceId)?.name ||
                              'Thiết bị đã chọn'
                            : 'Để trống = mọi thiết bị'
                        }
                        caption={
                          conditions[0]?.deviceId
                            ? 'Chỉ kích hoạt khi sự kiện phát sinh từ thiết bị này'
                            : 'Kích hoạt từ bất kỳ thiết bị nào'
                        }
                        icon="activity"
                        onClick={() =>
                          setDevicePickerMode({
                            open: true,
                            target: 'eventSource',
                            index: 0,
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                {/* ── Sub-view SCHEDULE ── */}
                {triggerType === 'SCHEDULE' && (
                  <div className="space-y-3">
                    <SceneScheduleSection
                      homeId={homeId}
                      targetId={currentRuleId || undefined}
                      targetKind="automation-rules"
                      onSchedulesChange={(scheds) => {
                        setDraftSchedules(scheds);
                        markDirty();
                      }}
                    />
                  </div>
                )}
              </section>

              {/* ── Section 3: Thì làm gì (Actions) ── */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
                      3. Thì làm gì (Hành động {actions.length})
                    </span>
                    <span className="text-[10px] text-[var(--tertiary)] block">
                      Chạy lần lượt từ trên xuống
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {actions.map((act, idx) => (
                    <ActionStepCard
                      key={idx}
                      action={act}
                      index={idx}
                      totalCount={actions.length}
                      devices={devices}
                      scenes={scenes}
                      isExpanded={expandedActIndex === idx}
                      onToggleExpand={() =>
                        setExpandedActIndex((cur) => (cur === idx ? null : idx))
                      }
                      onChange={(updated) => handleUpdateAction(idx, updated)}
                      onMoveUp={() => handleMoveAction(idx, 'up')}
                      onMoveDown={() => handleMoveAction(idx, 'down')}
                      onDuplicate={() => handleDuplicateAction(idx)}
                      onDelete={() => handleDeleteAction(idx)}
                      onPickDevice={() =>
                        setDevicePickerMode({
                          open: true,
                          target: 'action',
                          index: idx,
                        })
                      }
                      onPickScene={() => setScenePickerIndex(idx)}
                    />
                  ))}
                </div>

                {/* SplitButton for adding Actions */}
                <div className="pt-1">
                  <SplitButton
                    onAddDevice={handleAddDeviceAction}
                    onAddScene={handleAddSceneAction}
                  />
                </div>
              </section>
            </>
          )}
          </>
          )}
        </div>

        {/* ── Sticky Footer ── */}
        <footer className="scene-panel-footer shrink-0 p-4 border-t border-[var(--border)] bg-[var(--solid)]/80 backdrop-blur-md space-y-2">
          {validationError && activeTab === 'setup' && (
            <p className="text-center text-xs text-amber-600 font-medium">
              {validationError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRequestClose}
              className="px-4 py-3 rounded-2xl text-xs font-semibold text-[var(--secondary)] hover:bg-[var(--muted)] border border-[var(--border)] transition-colors cursor-pointer"
            >
              Đóng
            </button>

            {/* Secondary "Kiểm tra" button (hide for SCHEDULE rules) */}
            {triggerType !== 'SCHEDULE' && (
              <div className="flex-1 flex flex-col items-center">
                <button
                  type="button"
                  disabled={!currentRuleId}
                  onClick={() => setTestSheetOpen(true)}
                  className="w-full py-3 rounded-2xl text-xs font-semibold text-[var(--text)] bg-[var(--muted)] hover:bg-[var(--border)] border border-[var(--border)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Kiểm tra
                </button>
                {!currentRuleId ? (
                  <span className="text-[10px] text-[var(--tertiary)] mt-1">Lưu quy tắc để kiểm tra</span>
                ) : isDirty ? (
                  <span className="text-[10px] text-[var(--tertiary)] mt-1">Kiểm tra dựa trên bản đã lưu</span>
                ) : null}
              </div>
            )}

            {activeTab === 'setup' && (
              <button
                type="button"
                disabled={!isValid || saving}
                onClick={handleSaveRule}
                className="flex-1 py-3 rounded-2xl text-xs font-bold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 relative"
              >
                {isDirty && <span className="w-2 h-2 rounded-full bg-[var(--accent)] absolute left-4" />}
                {saving ? (
                  <>
                    <Icon name="clock" size={14} className="animate-spin" />
                    <span>Đang lưu quy tắc...</span>
                  </>
                ) : (
                  <span>{currentRuleId ? 'Lưu quy tắc' : 'Tạo quy tắc'}</span>
                )}
              </button>
            )}
          </div>
        </footer>
      </aside>

      {/* ── Sub-Sheet: DevicePickerSheet ── */}
      {devicePickerMode.open && (
        <DevicePickerSheet
          devices={devices}
          filterMode={
            devicePickerMode.target === 'condition'
              ? 'sensors-only'
              : devicePickerMode.target === 'eventSource'
              ? 'all'
              : 'actionable-only'
          }
          title={
            devicePickerMode.target === 'condition'
              ? 'Chọn cảm biến nguồn'
              : devicePickerMode.target === 'eventSource'
              ? 'Chọn thiết bị phát sinh sự kiện'
              : 'Chọn thiết bị điều khiển'
          }
          onSelect={(dev) => {
            markDirty();
            if (devicePickerMode.target === 'condition' && devicePickerMode.index !== undefined) {
              const idx = devicePickerMode.index;
              handleUpdateCondition(idx, {
                ...conditions[idx],
                deviceId: dev.id,
              });
            } else if (devicePickerMode.target === 'action' && devicePickerMode.index !== undefined) {
              const idx = devicePickerMode.index;
              handleUpdateAction(idx, {
                ...actions[idx],
                deviceId: dev.id,
              });
            } else if (devicePickerMode.target === 'eventSource') {
              setConditions((prev) => [
                {
                  ...prev[0],
                  deviceId: dev.id,
                },
              ]);
            }
            setDevicePickerMode({ open: false });
          }}
          onClose={() => setDevicePickerMode({ open: false })}
        />
      )}

      {/* ── Sub-Sheet: EventPickerSheet ── */}
      {eventPickerOpen && (
        <EventPickerSheet
          selectedEvent={String(conditions[0]?.expectedValue || '')}
          onSelect={(code) => {
            markDirty();
            setConditions((prev) => [
              {
                attribute: 'eventType',
                operator: 'EQ',
                expectedValue: code,
                logicalOperator: 'AND',
                order: 0,
                deviceId: prev[0]?.deviceId,
              },
            ]);
            setEventPickerOpen(false);
          }}
          onClose={() => setEventPickerOpen(false)}
        />
      )}

      {/* ── Sub-Sheet: ScenePickerSheet ── */}
      {scenePickerIndex !== null && (
        <ScenePickerSheet
          scenes={scenes}
          selectedSceneId={actions[scenePickerIndex]?.sceneId}
          onSelect={(sc) => {
            markDirty();
            handleUpdateAction(scenePickerIndex, {
              ...actions[scenePickerIndex],
              action: 'EXECUTE_SCENE',
              sceneId: sc.id,
            });
            setScenePickerIndex(null);
          }}
          onClose={() => setScenePickerIndex(null)}
        />
      )}

      {/* ── Sub-Sheet: RuleTestSheet ── */}
      {testSheetOpen && rule && (
        <RuleTestSheet
          homeId={homeId}
          rule={rule}
          devices={devices}
          scenes={scenes}
          onClose={() => setTestSheetOpen(false)}
        />
      )}

      {/* ── Confirm Modals ── */}
      {confirmCloseOpen && (
        <ConfirmModal
          isOpen={true}
          title="Bỏ thay đổi?"
          description="Bạn có các thay đổi chưa được lưu trong quy tắc này. Bạn có chắc chắn muốn thoát mà không lưu?"
          confirmText="Bỏ thay đổi"
          cancelText="Tiếp tục chỉnh sửa"
          variant="danger"
          onConfirm={() => {
            setConfirmCloseOpen(false);
            onClose();
          }}
          onCancel={() => setConfirmCloseOpen(false)}
        />
      )}

      {confirmDeleteOpen && (
        <ConfirmModal
          isOpen={true}
          title="Xóa quy tắc tự động"
          description={`Bạn có chắc chắn muốn xóa quy tắc “${name}”? Hành động này không thể hoàn tác.`}
          confirmText="Xóa quy tắc"
          cancelText="Hủy"
          variant="danger"
          onConfirm={handleDeleteRule}
          onCancel={() => setConfirmDeleteOpen(false)}
        />
      )}

      {confirmOverwriteOpOpen && (
        <ConfirmModal
          isOpen={true}
          title="Áp dụng toán tử kết hợp"
          description={`Quy tắc này đang dùng các điều kiện kết hợp khác nhau. Thay đổi sang ${
            pendingLogicalOp === 'AND' ? 'TẤT CẢ (VÀ)' : 'BẤT KỲ (HOẶC)'
          } sẽ áp dụng đồng nhất lên tất cả các điều kiện.`}
          confirmText="Áp dụng"
          cancelText="Hủy"
          onConfirm={handleConfirmOverwriteMixedOp}
          onCancel={() => setConfirmOverwriteOpOpen(false)}
        />
      )}
    </>
  );
};
