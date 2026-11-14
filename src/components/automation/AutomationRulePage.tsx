import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { currentHomeChanged, currentHomeCleared } from '../../store/homeSlice';
import {
  getAutomationRules,
  toggleAutomationRule,
  deleteAutomationRule,
  createAutomationRule,
} from '../../services/automationApi';
import { getDevices, getScenes } from '../../services/sceneApi';
import { getSchedules } from '../../services/scheduleApi';
import type {
  AutomationRule,
  AutomationRuleInput,
  DeviceSummary,
} from '../../types/automation';
import type { SceneResponse } from '../../types/scene';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { Icon } from '../ui/LucideIcon';
import { AutomationTopBar } from './AutomationTopBar';
import { AutomationEmpty } from './AutomationEmpty';
import { RuleCard } from './RuleCard';
import { RuleEditorPanel } from './RuleEditorPanel';
import { RuleHistoryPanel } from './RuleHistoryPanel';
import { ConfirmModal } from '../ui/ConfirmModal';
import { notify } from '../ui/notify';
import { useRealtimeRefetch } from '../../realtime/useRealtimeRefetch';

const AUTOMATION_REFRESH_EVENTS = ['AUTOMATION_RULE_CHANGED', 'SCENE_CHANGED'] as const;

const TRIGGER_GROUPS = [
  { id: 'SENSOR' as const, label: 'Cảm biến', hint: 'Chạy khi giá trị cảm biến khớp điều kiện' },
  { id: 'EVENT' as const, label: 'Sự kiện', hint: 'Chạy khi thiết bị báo một sự kiện' },
  { id: 'SCHEDULE' as const, label: 'Lịch', hint: 'Chạy vào giờ đã hẹn' },
];

export function AutomationRulePage() {
  const { homeId = '' } = useParams();
  const navigate = useNavigate();
  const authUser = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  // Subscribe the realtime socket to this home even when the page is opened directly.
  useEffect(() => {
    dispatch(currentHomeChanged(homeId || null));
    return () => {
      dispatch(currentHomeCleared());
    };
  }, [dispatch, homeId]);
  const userInitial = authUser?.fullName?.charAt(0) || authUser?.email?.charAt(0) || 'U';

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [scenes, setScenes] = useState<SceneResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and search
  const [statusFilter, setStatusFilter] = useState<'Tất cả' | 'Đang bật' | 'Đang tắt'>('Tất cả');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SENSOR' | 'EVENT' | 'SCHEDULE'>('ALL');
  const [query, setQuery] = useState('');

  // Modals & Panels
  const [editorRule, setEditorRule] = useState<AutomationRule | null | undefined>(undefined); // undefined = closed
  const [scrollToTrigger, setScrollToTrigger] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<AutomationRule | null>(null);
  const [historyModalRule, setHistoryModalRule] = useState<AutomationRule | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    if (!homeId) return;
    setError(null);
    try {
      const [fetchedRules, fetchedDevices, fetchedScenes] = await Promise.all([
        getAutomationRules(homeId),
        getDevices(homeId),
        getScenes(homeId),
      ]);
      setRules(fetchedRules || []);
      setDevices(fetchedDevices || []);
      setScenes(fetchedScenes || []);
    } catch (err: unknown) {
      console.warn('Load automation rules warning:', err);
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách quy tắc tự động.');
    } finally {
      setLoading(false);
    }
  }, [homeId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Rules list scenes by name, so a scene edit refreshes this page too.
  useRealtimeRefetch(AUTOMATION_REFRESH_EVENTS, homeId, () => void loadData());

  // Counts and statistics
  const activeCount = useMemo(() => rules.filter((r) => r.enabled).length, [rules]);

  // Filtered and searched rules
  const visibleRules = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rules.filter((rule) => {
      // Status filter
      if (statusFilter === 'Đang bật' && !rule.enabled) return false;
      if (statusFilter === 'Đang tắt' && rule.enabled) return false;

      // Type filter
      if (typeFilter !== 'ALL' && rule.triggerType !== typeFilter) return false;

      // Search query
      if (q) {
        const matchName = rule.name.toLowerCase().includes(q);
        const matchDesc = rule.description?.toLowerCase().includes(q);
        if (!matchName && !matchDesc) return false;
      }
      return true;
    });
  }, [rules, statusFilter, typeFilter, query]);

  // Optimistic Toggle
  const handleToggleRule = async (ruleId: string, nextEnabled: boolean) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled: nextEnabled } : r)),
    );
    try {
      await toggleAutomationRule(homeId, ruleId, nextEnabled);
      notify.success(nextEnabled ? 'Đã bật quy tắc' : 'Đã tắt quy tắc');
    } catch (err) {
      // Revert on error
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, enabled: !nextEnabled } : r)),
      );
      notify.error(err instanceof Error ? err.message : 'Không thể đổi trạng thái quy tắc');
    }
  };

  // Duplicate Rule
  const handleDuplicateRule = async (rule: AutomationRule) => {
    try {
      const input: AutomationRuleInput = {
        name: `${rule.name} (bản sao)`,
        description: rule.description,
        triggerType: rule.triggerType,
        enabled: false,
        conditions: (rule.conditions || []).map((c, i) => ({
          deviceId: c.deviceId,
          attribute: c.attribute,
          operator: c.operator,
          expectedValue: c.expectedValue,
          logicalOperator: c.logicalOperator || 'AND',
          order: i,
        })),
        actions: (rule.actions || []).map((a, i) => ({
          deviceId: a.deviceId,
          sceneId: a.sceneId,
          action: a.action,
          parameters: a.parameters || {},
          order: i,
        })),
      };
      if (rule.triggerType === 'SCHEDULE') {
        // The copy is created disabled, but its times go with it: a SCHEDULE rule cannot exist without one.
        const times = await getSchedules(homeId, 'automation-rules', rule.id);
        input.schedules = (times || []).map((t) => ({
          scheduledTime: t.scheduledTime,
          repeatDays: t.repeatDays || [],
          active: t.active,
        }));
      }
      await createAutomationRule(homeId, input);

      notify.success('Đã nhân bản quy tắc', `Đã tạo bản sao cho “${rule.name}”`);
      await loadData();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Không thể nhân bản quy tắc');
    }
  };

  // Delete Rule
  const handleConfirmDelete = async () => {
    if (!ruleToDelete) return;
    try {
      await deleteAutomationRule(homeId, ruleToDelete.id);
      notify.success('Đã xóa quy tắc', `Quy tắc “${ruleToDelete.name}” đã được xóa.`);
      setRuleToDelete(null);
      await loadData();
    } catch {
      notify.error('Không thể xóa quy tắc');
    }
  };

  const ruleRow = (rule: AutomationRule) => (
    <RuleCard
      key={rule.id}
      rule={rule}
      devices={devices}
      scenes={scenes}
      onToggle={(nextEnabled) => handleToggleRule(rule.id, nextEnabled)}
      onEdit={() => {
        setScrollToTrigger(false);
        setEditorRule(rule);
      }}
      onHistory={() => setHistoryModalRule(rule)}
      onSchedule={() => {
        setScrollToTrigger(true);
        setEditorRule(rule);
      }}
      onDuplicate={() => handleDuplicateRule(rule)}
      onDelete={() => setRuleToDelete(rule)}
    />
  );

  // Rules grouped by what starts them; empty groups are hidden.
  const groups = TRIGGER_GROUPS.map((group) => ({
    ...group,
    rules: visibleRules.filter((rule) => rule.triggerType === group.id),
  })).filter((group) => group.rules.length > 0);

  return (
    <div className="app-shell scenes-page studio st-theme st-pro">
      <DashboardNavRail
        homeId={homeId}
        activeItem="automations"
        user={authUser ?? undefined}
        onSelectOverview={() => navigate('/home')}
        onOpenSettings={() => {}}
        onOpenProfile={() => {}}
      />

      <main>
        <AutomationTopBar
          caption={`${rules.length} quy tắc · ${activeCount} đang bật`}
          title={<>Tự động hóa <span className="sr-only">Quy tắc tự động</span></>}
          subtitle="Để ngôi nhà tự phản ứng với cảm biến, sự kiện của thiết bị hoặc giờ hẹn."
          userInitial={userInitial}
        />

        <div className="st-toolbar">
          <div className="st-seg" role="tablist" aria-label="Lọc theo trạng thái">
            {(['Tất cả', 'Đang bật', 'Đang tắt'] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={statusFilter === item}
                className={statusFilter === item ? 'active' : ''}
                onClick={() => setStatusFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="st-seg" role="tablist" aria-label="Lọc theo loại kích hoạt">
            {[{ id: 'ALL' as const, label: 'Mọi loại' }, ...TRIGGER_GROUPS].map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={typeFilter === t.id}
                className={typeFilter === t.id ? 'active' : ''}
                onClick={() => setTypeFilter(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label className="st-search">
            <Icon name="search" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm quy tắc"
              aria-label="Tìm quy tắc"
            />
          </label>

          <div className="st-toolbar-end">
            <button
              type="button"
              className="st-link"
              onClick={() => navigate(homeId ? `/homes/${homeId}/scenes` : '/home')}
            >
              <Icon name="sparkles" />
              <span>Kịch bản</span>
            </button>
            <button
              type="button"
              className="st-link"
              onClick={() => navigate(homeId ? `/homes/${homeId}/recommendations` : '/home')}
            >
              <Icon name="zap" />
              <span>Gợi ý AI</span>
            </button>
            <button
              type="button"
              className="st-link"
              onClick={() => navigate(homeId ? `/homes/${homeId}/guardian` : '/home')}
            >
              <Icon name="shield" />
              <span>Giám hộ</span>
            </button>
            <button type="button" className="st-btn st-btn-primary" onClick={() => setEditorRule(null)}>
              <Icon name="plus" size={18} />
              Tạo quy tắc
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="st-alert error">
            <span>{error}</span>
            <button type="button" className="st-btn st-btn-sm" onClick={() => void loadData()}>
              Thử lại
            </button>
          </div>
        )}

        {loading ? (
          <div className="st-list" aria-busy="true">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="st-skeleton st-rule-skeleton" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <AutomationEmpty
            mode="empty"
            onCreate={() => setEditorRule(null)}
            onSelectTemplateName={(tmplName) => {
              setEditorRule(null);
              notify.info(`Đã chọn mẫu: ${tmplName}`);
            }}
          />
        ) : visibleRules.length === 0 ? (
          <AutomationEmpty
            mode={query ? 'search' : 'filter'}
            onResetSearch={() => {
              setQuery('');
              setStatusFilter('Tất cả');
              setTypeFilter('ALL');
            }}
          />
        ) : (
          groups.map((group) => (
            <section className="st-group" key={group.id} aria-label={group.label}>
              <header className="st-group-head">
                <h3>{group.label}</h3>
                <small>{group.rules.length}</small>
                <p>{group.hint}</p>
              </header>
              <div className="st-list">{group.rules.map(ruleRow)}</div>
            </section>
          ))
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <DashboardBottomNav activeItem="more" homeId={homeId} />

      {/* ── Rule Editor Panel (Phase 3 & 4) ── */}
      <RuleEditorPanel
        rule={editorRule}
        isOpen={editorRule !== undefined}
        onClose={() => {
          setEditorRule(undefined);
          setScrollToTrigger(false);
        }}
        onSaved={loadData}
        devices={devices}
        scenes={scenes}
        homeId={homeId}
        onDuplicate={handleDuplicateRule}
        initialScrollToTrigger={scrollToTrigger}
      />

      {/* ── Delete Confirmation Dialog ── */}
      {ruleToDelete && (
        <ConfirmModal
          isOpen={true}
          title="Xóa quy tắc tự động"
          description={`Bạn có chắc chắn muốn xóa quy tắc “${ruleToDelete.name}”? Thao tác này không thể hoàn tác.`}
          confirmText="Xóa quy tắc"
          cancelText="Hủy"
          variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setRuleToDelete(null)}
        />
      )}

      {/* ── Rule Execution History Panel ── */}
      {historyModalRule && (
        <RuleHistoryPanel
          homeId={homeId}
          rule={historyModalRule}
          devices={devices}
          scenes={scenes}
          onClose={() => setHistoryModalRule(null)}
        />
      )}
    </div>
  );
}
