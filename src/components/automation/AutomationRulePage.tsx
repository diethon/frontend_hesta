import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAppSelector } from '../../store/hooks';
import {
  getAutomationRules,
  toggleAutomationRule,
  deleteAutomationRule,
  createAutomationRule,
} from '../../services/automationApi';
import { getDevices, getScenes } from '../../services/sceneApi';
import { getSchedules, saveSchedule } from '../../services/scheduleApi';
import type {
  AutomationRule,
  AutomationRuleInput,
  DeviceSummary,
} from '../../types/automation';
import type { SceneResponse } from '../../types/scene';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { Icon, IconButton } from '../home/HomeIcons';
import { AutomationTopBar } from './AutomationTopBar';
import { AutomationEmpty } from './AutomationEmpty';
import { RuleCard } from './RuleCard';
import { RuleEditorPanel } from './RuleEditorPanel';
import { RuleTestSheet } from './RuleTestSheet';
import { RuleHistoryPanel } from './RuleHistoryPanel';
import { ConfirmModal } from '../ui/ConfirmModal';
import { notify } from '../ui/notify';

export function AutomationRulePage() {
  const { homeId = '' } = useParams();
  const navigate = useNavigate();
  const authUser = useAppSelector((state) => state.auth.user);
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
  const [searchOpen, setSearchOpen] = useState(false);

  // Modals & Panels
  const [editorRule, setEditorRule] = useState<AutomationRule | null | undefined>(undefined); // undefined = closed
  const [scrollToTrigger, setScrollToTrigger] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<AutomationRule | null>(null);
  const [testModalRule, setTestModalRule] = useState<AutomationRule | null>(null);
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

  // Counts and statistics
  const activeCount = useMemo(() => rules.filter((r) => r.enabled).length, [rules]);
  const totalConditions = useMemo(
    () => rules.reduce((acc, r) => acc + (r.conditions?.length || 0), 0),
    [rules],
  );
  const totalActions = useMemo(
    () => rules.reduce((acc, r) => acc + (r.actions?.length || 0), 0),
    [rules],
  );

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
      notify.error('Không thể đổi trạng thái quy tắc');
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
      const created = await createAutomationRule(homeId, input);

      // If this is a SCHEDULE rule, also copy its schedules
      if (rule.triggerType === 'SCHEDULE' && created?.id) {
        try {
          const existingSchedules = await getSchedules(homeId, 'automation-rules', rule.id);
          if (Array.isArray(existingSchedules) && existingSchedules.length > 0) {
            for (const sched of existingSchedules) {
              await saveSchedule(homeId, 'automation-rules', created.id, {
                scheduledTime: sched.scheduledTime,
                repeatDays: sched.repeatDays || [],
                active: false,
              });
            }
          }
        } catch (schedErr) {
          console.warn('Could not copy schedules during duplicate:', schedErr);
        }
      }

      notify.success('Đã nhân bản quy tắc', `Đã tạo bản sao cho “${rule.name}”`);
      await loadData();
    } catch {
      notify.error('Không thể nhân bản quy tắc');
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

  return (
    <div className="app-shell scenes-page">
      {/* Decorative gradient meshes */}
      <div className="mesh mesh-one" />
      <div className="mesh mesh-two" />
      <div className="mesh mesh-three" />

      {/* Desktop/Tablet NavRail */}
      <DashboardNavRail
        homeId={homeId}
        activeItem="automations"
        user={authUser ?? undefined}
        onSelectOverview={() => navigate('/home')}
        onOpenSettings={() => {}}
        onOpenProfile={() => {}}
      />

      <main>
        {/* TopBar */}
        <AutomationTopBar
          totalCount={rules.length}
          activeCount={activeCount}
          userInitial={userInitial}
        />

        {/* Action Row */}
        <div className="scenes-actions">
          {/* Left: Status segmented control + Trigger Type Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="scene-filter">
              {(['Tất cả', 'Đang bật', 'Đang tắt'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={statusFilter === item ? 'active' : ''}
                  onClick={() => setStatusFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            {/* Trigger Type Filter Pills */}
            <div className="flex items-center gap-1 bg-[var(--solid)] p-1 rounded-full border border-[var(--border)]">
              {[
                { id: 'ALL', label: 'Tất cả loại' },
                { id: 'SENSOR', label: 'Cảm biến' },
                { id: 'EVENT', label: 'Sự kiện' },
                { id: 'SCHEDULE', label: 'Lịch' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeFilter(t.id as typeof typeFilter)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                    typeFilter === t.id
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-bold'
                      : 'text-[var(--secondary)] hover:text-[var(--text)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right actions: search, ghost link to Kịch bản, ghost link to Gợi ý AI, + Tạo quy tắc */}
          <div className="scene-actions-right">
            {searchOpen && (
              <input
                autoFocus
                className="inline-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm quy tắc..."
              />
            )}

            <IconButton
              icon="search"
              label="Tìm kiếm quy tắc"
              onClick={() => setSearchOpen(!searchOpen)}
            />

            <button
              type="button"
              className="scene-ghost"
              onClick={() => navigate(homeId ? `/homes/${homeId}/scenes` : '/home')}
            >
              Kịch bản ({scenes.length})
            </button>

            <button
              type="button"
              className="scene-ghost"
              onClick={() => navigate(homeId ? `/homes/${homeId}/recommendations` : '/home')}
            >
              <Icon name="sparkles" size={17} />
              Gợi ý AI
            </button>

            <button
              type="button"
              className="add-device"
              onClick={() => setEditorRule(null)}
            >
              + Tạo quy tắc
            </button>
          </div>
        </div>

        {/* Summary Strip (Neutral StatChips) */}
        <div className="scene-summary">
          <span className="stat">{rules.length} quy tắc</span>
          <span className="stat">{activeCount} đang bật</span>
          <span className="stat">{totalConditions} điều kiện</span>
          <span className="stat">{totalActions} hành động</span>
        </div>

        {/* API Error Notification */}
        {error && (
          <div
            role="alert"
            className="mb-4 flex items-center justify-between p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void loadData()}
              className="px-3 py-1 rounded-xl bg-white border border-rose-200 text-rose-700 font-bold hover:bg-rose-100 transition-colors cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* ── Content Grid ── */}
        {loading ? (
          <div className="rules-grid">
            {Array.from({ length: 6 }).map((_, idx) => (
              <RuleCard key={idx} loading />
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
          <div className="rules-grid">
            {visibleRules.map((rule) => (
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
                onTest={() => setTestModalRule(rule)}
                onHistory={() => setHistoryModalRule(rule)}
                onSchedule={() => {
                  setScrollToTrigger(true);
                  setEditorRule(rule);
                }}
                onDuplicate={() => handleDuplicateRule(rule)}
                onDelete={() => setRuleToDelete(rule)}
              />
            ))}
          </div>
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

      {/* ── Rule Test Simulation Sheet ── */}
      {testModalRule && (
        <RuleTestSheet
          homeId={homeId}
          rule={testModalRule}
          devices={devices}
          scenes={scenes}
          onClose={() => setTestModalRule(null)}
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
