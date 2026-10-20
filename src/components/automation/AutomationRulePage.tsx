import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import {
  Play,
  Plus,
  Trash2,
  Edit3,
  Clock,
  Sliders,
  Sparkles,
  Calendar,
  History,
  Zap,
  Activity,
  Check,
  Layers,
  Sun,
  Palette,
  Thermometer,
  Fan,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import {
  createAutomationRule,
  deleteAutomationRule,
  getAutomationExecutions,
  getAutomationRules,
  testAutomationRule,
  toggleAutomationRule,
  updateAutomationRule,
} from '../../services/automationApi';
import { getDevices, getScenes } from '../../services/sceneApi';
import type {
  AutomationExecution,
  AutomationRule,
  AutomationTestResult,
  DeviceSummary,
} from '../../types/automation';
import type { SceneResponse } from '../../types/scene';
import {
  actionOptions,
  buildActionInput,
  getDeviceActions,
  type DraftAction,
} from './automationActions';
import { SchedulePanel } from '../ui/SchedulePanel';
import { HomeSidebar } from '../ui/HomeSidebar';
import { getDeviceTypeIcon } from '../scene/sceneConstants';
import { COLOR_PRESETS } from '../device/deviceMultiActionHelpers';
import { ConfirmModal } from '../ui/ConfirmModal';
import { notify } from '../ui/notify';

interface DraftCondition {
  deviceId: string;
  attribute: string;
  operator: 'EQ' | 'NE' | 'GT' | 'GTE' | 'LT' | 'LTE';
  expected: string;
  logicalOperator: 'AND' | 'OR';
}

const triggerLabels: Record<string, { label: string; icon: typeof Activity }> = {
  SENSOR: { label: 'Dữ liệu cảm biến', icon: Activity },
  EVENT: { label: 'Sự kiện hệ thống', icon: Zap },
  SCHEDULE: { label: 'Theo lịch hẹn giờ', icon: Clock },
};

const conditionOperators = [
  { code: 'EQ', label: '= Bằng' },
  { code: 'NE', label: '≠ Khác' },
  { code: 'GT', label: '> Lớn hơn' },
  { code: 'GTE', label: '≥ Lớn hơn hoặc bằng' },
  { code: 'LT', label: '< Nhỏ hơn' },
  { code: 'LTE', label: '≤ Nhỏ hơn hoặc bằng' },
] as const;

export function AutomationRulePage() {
  const { homeId = '' } = useParams();

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [scenes, setScenes] = useState<SceneResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [historyRuleId, setHistoryRuleId] = useState<string | null>(null);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [testRuleId, setTestRuleId] = useState<string | null>(null);
  const [scheduleRuleId, setScheduleRuleId] = useState<string | null>(null);
  const [testData, setTestData] = useState('{}');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AutomationTestResult | null>(null);
  const [triggerType, setTriggerType] = useState<'SENSOR' | 'EVENT' | 'SCHEDULE'>('SENSOR');
  const [conditions, setConditions] = useState<DraftCondition[]>([]);
  const [actions, setActions] = useState<DraftAction[]>([]);
  const [error, setError] = useState('');
  const [ruleToDelete, setRuleToDelete] = useState<AutomationRule | null>(null);

  const load = useCallback(async () => {
    try {
      const [ruleResult, deviceResult, sceneResult] = await Promise.all([
        getAutomationRules(homeId),
        getDevices(homeId),
        getScenes(homeId),
      ]);
      setRules(ruleResult);
      setDevices(deviceResult);
      setScenes(sceneResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [homeId]);

  useEffect(() => {
    let active = true;
    Promise.all([
      getAutomationRules(homeId),
      getDevices(homeId),
      getScenes(homeId),
    ])
      .then(([ruleResult, deviceResult, sceneResult]) => {
        if (!active) return;
        setRules(ruleResult);
        setDevices(deviceResult);
        setScenes(sceneResult);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Không thể tải dữ liệu');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [homeId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const input = {
        name: name.trim(),
        description: description.trim(),
        triggerType,
        enabled: editingRule?.enabled ?? true,
        conditions: conditions.map((item, order) => ({
          ...item,
          expectedValue: parseValue(item.expected),
          order,
        })),
        actions: actions.map((item, order) => buildActionInput(item, order, devices)),
      };
      if (editingRule) {
        await updateAutomationRule(homeId, editingRule.id, input);
        notify.success('Cập nhật quy tắc thành công', `Quy tắc “${name}” đã được lưu.`);
      } else {
        await createAutomationRule(homeId, input);
        notify.success('Tạo quy tắc thành công', `Quy tắc “${name}” đã sẵn sàng hoạt động.`);
      }
      clearEditor();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Dữ liệu quy tắc không hợp lệ');
    } finally {
      setSubmitting(false);
    }
  };

  const clearEditor = () => {
    setEditingRule(null);
    setName('');
    setDescription('');
    setTriggerType('SENSOR');
    setConditions([]);
    setActions([]);
  };

  const edit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setDescription(rule.description ?? '');
    setTriggerType(rule.triggerType);
    setConditions(
      rule.conditions.map((item) => ({
        deviceId: item.deviceId ?? '',
        attribute: item.attribute,
        operator: item.operator,
        expected:
          typeof item.expectedValue === 'string'
            ? item.expectedValue
            : JSON.stringify(item.expectedValue),
        logicalOperator: item.logicalOperator,
      })),
    );
    setActions(
      rule.actions.map((item) => {
        const option = actionOptions.find((candidate) => candidate.code === item.action);
        return {
          deviceId: item.deviceId ?? '',
          sceneId: item.sceneId,
          action: item.action,
          value:
            option?.valueKind === 'json'
              ? JSON.stringify(item.parameters)
              : option?.parameterKey
              ? String(item.parameters[option.parameterKey] ?? '')
              : '',
        };
      }),
    );
    // Smooth scroll to editor
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmDelete = async () => {
    if (!ruleToDelete) return;
    try {
      await deleteAutomationRule(homeId, ruleToDelete.id);
      if (editingRule?.id === ruleToDelete.id) clearEditor();
      notify.success('Đã xóa quy tắc', `Quy tắc “${ruleToDelete.name}” đã được gỡ bỏ.`);
      setRuleToDelete(null);
      await load();
    } catch (caught) {
      notify.error(caught instanceof Error ? caught.message : 'Không thể xóa quy tắc.');
    }
  };

  const showHistory = async (ruleId: string) => {
    if (historyRuleId === ruleId) {
      setHistoryRuleId(null);
      return;
    }
    setHistoryRuleId(ruleId);
    setExecutions([]);
    setLoadingHistory(true);
    try {
      setExecutions(await getAutomationExecutions(homeId, ruleId));
    } catch (caught) {
      notify.error(caught instanceof Error ? caught.message : 'Không thể tải lịch sử.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const openTest = (rule: AutomationRule) => {
    setTestRuleId(testRuleId === rule.id ? null : rule.id);
    setTestResult(null);
    const data = Object.fromEntries(
      rule.conditions
        .filter((item) => item.attribute !== 'eventType')
        .map((item) => [item.attribute, item.expectedValue]),
    );
    setTestData(JSON.stringify(data, null, 2));
  };

  const runTest = async (rule: AutomationRule) => {
    setError('');
    setTestResult(null);
    setTesting(true);
    try {
      const data: unknown = JSON.parse(testData);
      if (!data || Array.isArray(data) || typeof data !== 'object') {
        throw new Error('Dữ liệu chạy thử phải là đối tượng JSON.');
      }
      setTestResult(
        await testAutomationRule(homeId, rule.id, {
          sourceDeviceId: rule.conditions[0]?.deviceId,
          eventType: rule.triggerType === 'SENSOR' ? 'SENSOR_READING' : 'EVENT',
          data: data as Record<string, unknown>,
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể chạy thử.');
    } finally {
      setTesting(false);
    }
  };

  const addCondition = () =>
    setConditions((items) => [
      ...items,
      {
        deviceId: devices[0]?.id || '',
        attribute: 'temperature',
        operator: 'GT',
        expected: '30',
        logicalOperator: 'AND',
      },
    ]);

  const addAction = () => {
    const device = devices.find((candidate) => getDeviceActions(candidate).length > 0);
    const option = getDeviceActions(device)[0];
    if (device && option) {
      setActions((items) => [
        ...items,
        { deviceId: device.id, action: option.code, value: option.defaultValue },
      ]);
    }
  };

  const addSceneAction = () => {
    if (availableScenes[0]) {
      setActions((items) => [
        ...items,
        { deviceId: '', sceneId: availableScenes[0].id, action: 'EXECUTE_SCENE', value: '' },
      ]);
    }
  };

  const updateCondition = (index: number, patch: Partial<DraftCondition>) =>
    setConditions((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const updateAction = (index: number, patch: Partial<DraftAction>) =>
    setActions((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const changeActionDevice = (index: number, deviceId: string) => {
    const dev = devices.find((device) => device.id === deviceId);
    const option = getDeviceActions(dev)[0];
    updateAction(index, {
      deviceId,
      action: option?.code ?? '',
      value: option?.defaultValue ?? '',
    });
  };

  const changeActionType = (index: number, actionCode: string) => {
    const option = actionOptions.find((candidate) => candidate.code === actionCode);
    updateAction(index, { action: actionCode, value: option?.defaultValue ?? '' });
  };

  const hasActionableDevice = devices.some((device) => getDeviceActions(device).length > 0);
  const availableScenes = scenes.filter((scene) => scene.enabled && scene.actions.length > 0);

  return (
    <div className="app-shell relative min-h-screen bg-canvas text-text">
      {/* ── SIDEBAR NAVIGATION ── */}
      <HomeSidebar
        activeItem="automations"
        homeId={homeId}
      />

      {/* ── MAIN CONTENT WORKSPACE ── */}
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 lg:pl-64 space-y-6 max-w-7xl mx-auto">
        {/* Header Breadcrumbs & Quick Nav */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted">
              <Link to="/home" className="hover:text-primary transition-colors">
                Trang chủ
              </Link>
              <ChevronRight size={12} />
              <span className="text-text font-bold">Quy tắc tự động</span>
            </div>
            <h1 className="text-2xl font-black text-text tracking-tight mt-1 flex items-center gap-2.5">
              <Zap className="text-primary" size={24} />
              <span>Quy tắc tự động hóa</span>
            </h1>
            <p className="text-xs text-muted mt-0.5">
              Tạo các điều kiện thông minh để kích hoạt thiết bị và kịch bản tự động.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/homes/${homeId}/scenes`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-surface hover:bg-sidebar text-xs font-bold text-text transition-all shadow-2xs"
            >
              <Layers size={14} className="text-primary" />
              <span>Kịch bản ({scenes.length})</span>
            </Link>
            <Link
              to={`/homes/${homeId}/recommendations`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-surface hover:bg-sidebar text-xs font-bold text-text transition-all shadow-2xs"
            >
              <Sparkles size={14} className="text-amber-500" />
              <span>Gợi ý AI</span>
            </Link>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-300 text-rose-700 text-xs font-semibold animate-in fade-in"
          >
            <AlertCircle size={18} className="shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* ── WORKSPACE GRID ── */}
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* LEFT: RULES LIST */}
          <section className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-text uppercase tracking-wider">
                  Danh sách quy tắc
                </h2>
                <span className="text-xs text-muted font-medium">
                  {rules.length} quy tắc đang cấu hình
                </span>
              </div>

              {editingRule && (
                <button
                  type="button"
                  onClick={clearEditor}
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20 cursor-pointer"
                >
                  <Plus size={12} />
                  <span>Tạo quy tắc mới</span>
                </button>
              )}
            </div>

            {loading ? (
              <div className="surface-card p-8 flex flex-col items-center justify-center space-y-3">
                <Loader2 size={24} className="animate-spin text-primary" />
                <span className="text-xs text-muted font-medium">Đang tải danh sách quy tắc...</span>
              </div>
            ) : !rules.length ? (
              <div className="surface-card p-8 text-center space-y-2 border-dashed border-2">
                <Zap size={32} className="mx-auto text-muted/60" />
                <p className="text-sm font-bold text-text">Chưa có quy tắc tự động nào</p>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  Tạo quy tắc đầu tiên ở khung bên phải để hệ thống tự động phản hồi dữ liệu cảm biến
                  hoặc lịch trình.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => {
                  const TriggerIcon = triggerLabels[rule.triggerType]?.icon || Zap;
                  const isEditingThis = editingRule?.id === rule.id;

                  return (
                    <article
                      key={rule.id}
                      className={`relative overflow-hidden rounded-2xl border p-4.5 transition-all duration-200 bg-surface shadow-2xs hover:shadow-xs ${
                        isEditingThis
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                          : 'border-line'
                      }`}
                    >
                      {/* Rule Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`p-1.5 rounded-lg border text-primary shrink-0 ${
                                rule.enabled
                                  ? 'bg-primary/10 border-primary/20 text-primary'
                                  : 'bg-sidebar border-line text-muted'
                              }`}
                            >
                              <TriggerIcon size={14} />
                            </span>
                            <h3 className="font-bold text-sm text-text truncate">{rule.name}</h3>
                          </div>

                          <p className="text-xs text-muted mt-1.5 line-clamp-2">
                            {rule.description || 'Chưa có mô tả cho quy tắc này.'}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[11px] font-semibold text-muted">
                            <span className="bg-sidebar px-2 py-0.5 rounded-md border border-line">
                              {triggerLabels[rule.triggerType]?.label}
                            </span>
                            <span>·</span>
                            <span>{rule.conditions.length} điều kiện</span>
                            <span>·</span>
                            <span>{rule.actions.length} hành động</span>
                          </div>
                        </div>

                        {/* Power Toggle Switch */}
                        <button
                          type="button"
                          onClick={() =>
                            void toggleAutomationRule(homeId, rule.id, !rule.enabled)
                              .then(load)
                              .catch((c: unknown) =>
                                notify.error(
                                  c instanceof Error ? c.message : 'Không thể đổi trạng thái',
                                ),
                              )
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                            rule.enabled ? 'bg-emerald-500 shadow-xs' : 'bg-slate-300'
                          }`}
                          title={rule.enabled ? 'Tắt quy tắc' : 'Bật quy tắc'}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out mt-1 ml-1 ${
                              rule.enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Rule Action Toolbar */}
                      <div className="mt-3.5 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <button
                            type="button"
                            onClick={() => edit(rule)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-line bg-surface hover:bg-sidebar text-text font-semibold transition-all cursor-pointer shadow-2xs"
                          >
                            <Edit3 size={12} />
                            <span>Sửa</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openTest(rule)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                              testRuleId === rule.id
                                ? 'bg-primary text-white border-primary'
                                : 'border-line bg-surface hover:bg-sidebar text-text'
                            }`}
                          >
                            <Play size={12} />
                            <span>Chạy thử</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void showHistory(rule.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                              historyRuleId === rule.id
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'border-line bg-surface hover:bg-sidebar text-text'
                            }`}
                          >
                            <History size={12} />
                            <span>Lịch sử</span>
                          </button>

                          {rule.triggerType === 'SCHEDULE' && (
                            <button
                              type="button"
                              onClick={() =>
                                setScheduleRuleId(scheduleRuleId === rule.id ? null : rule.id)
                              }
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                                scheduleRuleId === rule.id
                                  ? 'bg-amber-500 text-white border-amber-500'
                                  : 'border-line bg-surface hover:bg-sidebar text-text'
                              }`}
                            >
                              <Calendar size={12} />
                              <span>Lịch chạy</span>
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setRuleToDelete(rule)}
                          className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                          title="Xóa quy tắc"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Inline Test Panel */}
                      {testRuleId === rule.id && (
                        <div className="mt-3.5 space-y-2.5 rounded-xl bg-sidebar/70 p-3.5 border border-line text-xs animate-in fade-in">
                          <label className="block font-bold text-text">
                            Dữ liệu sự kiện giả lập (JSON):
                            <textarea
                              rows={3}
                              value={testData}
                              onChange={(e) => setTestData(e.target.value)}
                              className="w-full mt-1.5 rounded-xl border border-line bg-surface p-2.5 font-mono text-xs text-text focus:border-primary focus:outline-none"
                            />
                          </label>
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              disabled={testing}
                              onClick={() => void runTest(rule)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary-hover transition-all cursor-pointer disabled:opacity-50"
                            >
                              {testing ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Play size={13} />
                              )}
                              <span>Kiểm tra điều kiện</span>
                            </button>
                            <span className="text-[11px] text-muted italic">
                              * Không gửi lệnh thực tế tới thiết bị.
                            </span>
                          </div>

                          {testResult && (
                            <div
                              className={`p-3 rounded-xl border flex items-start gap-2.5 mt-2 ${
                                testResult.matched
                                  ? 'bg-emerald-500/10 border-emerald-300 text-emerald-800'
                                  : 'bg-amber-500/10 border-amber-300 text-amber-800'
                              }`}
                            >
                              {testResult.matched ? (
                                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                              ) : (
                                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                              )}
                              <div>
                                <p className="font-bold">
                                  {testResult.matched
                                    ? `Khớp điều kiện · ${testResult.proposedActions.length} hành động sẽ kích hoạt!`
                                    : 'Không khớp điều kiện thử nghiệm.'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Inline History Panel */}
                      {historyRuleId === rule.id && (
                        <div className="mt-3.5 rounded-xl bg-sidebar/70 p-3.5 border border-line text-xs space-y-2 animate-in fade-in">
                          <div className="flex items-center justify-between border-b border-line pb-1.5 font-bold">
                            <span>Lịch sử thực thi gần đây</span>
                            <span className="text-[11px] text-muted">
                              {executions.length} lần chạy
                            </span>
                          </div>
                          {loadingHistory ? (
                            <div className="py-4 text-center">
                              <Loader2 size={18} className="animate-spin mx-auto text-primary" />
                            </div>
                          ) : !executions.length ? (
                            <p className="text-muted italic py-2">Chưa có lần thực thi nào.</p>
                          ) : (
                            executions.map((item) => (
                              <div
                                key={item.id}
                                className="border-b border-line/60 py-2 last:border-0"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-text">
                                    {new Date(item.matchedAt).toLocaleString('vi-VN')}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      item.status === 'SUCCESS'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}
                                  >
                                    {item.status}
                                  </span>
                                </div>
                                <ol className="mt-1 list-inside list-decimal text-[11px] text-muted space-y-0.5">
                                  {item.resultDetail.map((result, idx) => (
                                    <li key={`${item.id}-${idx}`}>
                                      {result.sceneId
                                        ? scenes.find((s) => s.id === result.sceneId)?.name ??
                                          result.sceneId
                                        : devices.find((d) => d.id === result.deviceId)?.name ??
                                          result.deviceId}
                                      : {result.action} · {result.status}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {/* Inline Schedule Panel */}
                      {scheduleRuleId === rule.id && (
                        <div className="mt-3.5 pt-3 border-t border-line">
                          <SchedulePanel homeId={homeId} kind="automation-rules" targetId={rule.id} />
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* RIGHT: RULE EDITOR FORM */}
          <section className="lg:col-span-7">
            <form
              onSubmit={submit}
              className="surface-card p-5 sm:p-6 rounded-3xl border border-line shadow-soft space-y-6"
            >
              {/* Form Title */}
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                    <Sliders size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-text">
                      {editingRule ? 'Chỉnh sửa quy tắc' : 'Tạo quy tắc tự động hóa'}
                    </h2>
                    <p className="text-xs text-muted">
                      {editingRule
                        ? `Đang chỉnh sửa: “${editingRule.name}”`
                        : 'Thiết lập điều kiện cảm biến, sự kiện và hành động phản hồi.'}
                    </p>
                  </div>
                </div>

                {editingRule && (
                  <button
                    type="button"
                    onClick={clearEditor}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-text px-2.5 py-1.5 rounded-xl border border-line hover:bg-sidebar transition-colors cursor-pointer"
                  >
                    <RotateCcw size={12} />
                    <span>Tạo mới</span>
                  </button>
                )}
              </div>

              {/* 1. Basic Metadata */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="rule-name" className="block text-xs font-bold text-text mb-1.5">
                    Tên quy tắc <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="rule-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ví dụ: Bật đèn khi phát hiện chuyển động ban đêm"
                    className="w-full rounded-2xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-text placeholder-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 transition-all shadow-2xs"
                  />
                </div>

                <div>
                  <label
                    htmlFor="rule-description"
                    className="block text-xs font-bold text-text mb-1.5"
                  >
                    Mô tả mục đích
                  </label>
                  <textarea
                    id="rule-description"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mô tả hoàn cảnh và hành vi dự kiến của quy tắc..."
                    className="w-full rounded-2xl border border-line bg-surface px-4 py-2 text-xs text-text placeholder-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 transition-all shadow-2xs resize-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="rule-trigger"
                    className="block text-xs font-bold text-text mb-1.5"
                  >
                    Loại kích hoạt (Trigger Type)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['SENSOR', 'EVENT', 'SCHEDULE'] as const).map((type) => {
                      const TriggerIcon = triggerLabels[type].icon;
                      const isSelected = triggerType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setTriggerType(type);
                            if (type === 'SCHEDULE') setConditions([]);
                          }}
                          className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20 shadow-xs'
                              : 'border-line bg-surface hover:bg-sidebar text-muted'
                          }`}
                        >
                          <TriggerIcon size={18} className="mb-1.5" />
                          <span>{triggerLabels[type].label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 2. Conditions Section */}
              <div className="space-y-3 pt-3 border-t border-line">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders size={16} className="text-primary" />
                    <h3 className="text-xs font-bold text-text uppercase tracking-wider">
                      Điều kiện kích hoạt
                    </h3>
                  </div>

                  {triggerType !== 'SCHEDULE' && (
                    <button
                      type="button"
                      disabled={!devices.length}
                      onClick={addCondition}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-surface hover:bg-sidebar text-xs font-bold text-text transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-40"
                    >
                      <Plus size={13} className="text-primary" />
                      <span>Thêm điều kiện</span>
                    </button>
                  )}
                </div>

                {triggerType === 'SCHEDULE' && (
                  <p className="text-xs text-muted italic bg-sidebar/50 p-3 rounded-xl border border-dashed border-line">
                    Đối với quy tắc Theo lịch, thời gian chạy được quản lý trong bảng lịch trình sau
                    khi tạo.
                  </p>
                )}

                {triggerType !== 'SCHEDULE' && !conditions.length && (
                  <p className="text-xs text-muted italic bg-sidebar/50 p-3 rounded-xl border border-dashed border-line">
                    Chưa có điều kiện nào. Bấm “Thêm điều kiện” để xác định cảm biến hoặc ngưỡng dữ
                    liệu.
                  </p>
                )}

                {conditions.map((condition, index) => {
                  const condDev = devices.find((d) => d.id === condition.deviceId);
                  const DevIcon = getDeviceTypeIcon(condDev?.deviceType);

                  return (
                    <div
                      key={index}
                      className="rounded-2xl border border-line bg-sidebar/40 p-3.5 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-line/60 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-xs font-bold text-text">
                            Điều kiện {index + 1}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setConditions((items) => items.filter((_, i) => i !== index))}
                          className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Xóa điều kiện này"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div>
                          <label className="block text-[11px] font-bold text-muted mb-1 flex items-center gap-1.5">
                            <DevIcon size={13} className="text-primary" />
                            <span>Thiết bị cảm biến</span>
                          </label>
                          <select
                            value={condition.deviceId}
                            onChange={(e) => updateCondition(index, { deviceId: e.target.value })}
                            className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-medium text-text focus:border-primary focus:outline-none"
                          >
                            {devices.map((device) => (
                              <option key={device.id} value={device.id}>
                                {device.name} ({device.deviceType || 'Thiết bị'})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-muted mb-1">
                            Thuộc tính theo dõi
                          </label>
                          <input
                            value={condition.attribute}
                            onChange={(e) => updateCondition(index, { attribute: e.target.value })}
                            placeholder="Ví dụ: temperature, motion, lux..."
                            className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-text focus:border-primary focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-muted mb-1">
                            Toán tử so sánh
                          </label>
                          <select
                            value={condition.operator}
                            onChange={(e) =>
                              updateCondition(index, {
                                operator: e.target.value as DraftCondition['operator'],
                              })
                            }
                            className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-text focus:border-primary focus:outline-none"
                          >
                            {conditionOperators.map((op) => (
                              <option key={op.code} value={op.code}>
                                {op.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-muted mb-1">
                            Giá trị ngưỡng so sánh
                          </label>
                          <input
                            value={condition.expected}
                            onChange={(e) => updateCondition(index, { expected: e.target.value })}
                            placeholder="Ví dụ: 30, true, ACTIVE..."
                            className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-medium text-text focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 3. Actions Section (Capability-driven) */}
              <div className="space-y-3.5 pt-3 border-t border-line">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-primary" />
                    <h3 className="text-xs font-bold text-text uppercase tracking-wider">
                      Hành động thực thi
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!hasActionableDevice}
                      onClick={addAction}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-40"
                    >
                      <Plus size={13} />
                      <span>Thêm thiết bị</span>
                    </button>
                    <button
                      type="button"
                      disabled={!availableScenes.length}
                      onClick={addSceneAction}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-surface hover:bg-sidebar text-xs font-bold text-text transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-40"
                    >
                      <Layers size={13} className="text-primary" />
                      <span>Thêm kịch bản</span>
                    </button>
                  </div>
                </div>

                {!hasActionableDevice && !availableScenes.length && (
                  <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
                    Chưa có thiết bị hoặc kịch bản hỗ trợ hành động tự động.
                  </p>
                )}

                {!actions.length && (
                  <p className="text-xs text-muted italic bg-sidebar/50 p-3 rounded-xl border border-dashed border-line">
                    Chưa có hành động nào. Bấm “Thêm thiết bị” hoặc “Thêm kịch bản” để thêm thao tác tự
                    động.
                  </p>
                )}

                {/* Actions Pipeline Cards */}
                {actions.map((action, index) => {
                  // Scene Action Card
                  if (action.action === 'EXECUTE_SCENE') {
                    return (
                      <div
                        key={index}
                        className="rounded-2xl border border-line bg-surface p-3.5 space-y-2.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between border-b border-line pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-700 font-bold text-[10px] flex items-center justify-center">
                              {index + 1}
                            </span>
                            <span className="text-xs font-bold text-text flex items-center gap-1.5">
                              <Layers size={14} className="text-indigo-600" />
                              <span>Kích hoạt kịch bản</span>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActions((items) => items.filter((_, i) => i !== index))}
                            className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 cursor-pointer"
                            title="Xóa hành động"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <select
                          value={action.sceneId ?? ''}
                          onChange={(e) => updateAction(index, { sceneId: e.target.value })}
                          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-text focus:border-primary focus:outline-none"
                        >
                          {availableScenes.map((scene) => (
                            <option key={scene.id} value={scene.id}>
                              {scene.name} ({scene.actions.length} lệnh)
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  // Device Action Card with Capabilities
                  const selectedDevice = devices.find((d) => d.id === action.deviceId);
                  const availableActions = getDeviceActions(selectedDevice);
                  const selectedOption = availableActions.find((opt) => opt.code === action.action);
                  const DevIcon = getDeviceTypeIcon(selectedDevice?.deviceType);

                  return (
                    <div
                      key={index}
                      className="rounded-2xl border border-line bg-surface p-4 space-y-3.5 shadow-2xs"
                    >
                      {/* Step Header */}
                      <div className="flex items-center justify-between border-b border-line pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-xs font-bold text-text flex items-center gap-1.5">
                            <DevIcon size={14} className="text-primary" />
                            <span>{selectedDevice?.name || 'Chọn thiết bị'}</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActions((items) => items.filter((_, i) => i !== index))}
                          className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 cursor-pointer"
                          title="Xóa hành động"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Device Selector & Action Dropdown */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-[11px] font-bold text-muted mb-1">
                            Thiết bị thực thi
                          </label>
                          <select
                            value={action.deviceId}
                            onChange={(e) => changeActionDevice(index, e.target.value)}
                            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-text focus:border-primary focus:outline-none"
                          >
                            {devices.map((device) => (
                              <option key={device.id} value={device.id}>
                                {device.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-muted mb-1">
                            Hành động
                          </label>
                          <select
                            value={action.action}
                            onChange={(e) => changeActionType(index, e.target.value)}
                            disabled={!availableActions.length}
                            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-text focus:border-primary focus:outline-none"
                          >
                            {!availableActions.length && (
                              <option value="">Không có hành động phù hợp</option>
                            )}
                            {availableActions.map((option) => (
                              <option key={option.code} value={option.code}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* ── RICH CAPABILITY CONTROLS ── */}
                      {/* 1. POWER (TURN_ON / TURN_OFF / TOGGLE) */}
                      {(action.action === 'TURN_ON' ||
                        action.action === 'TURN_OFF' ||
                        action.action === 'TOGGLE') && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                            Trạng thái nguồn:
                          </span>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => updateAction(index, { action: 'TURN_ON', value: '' })}
                              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                action.action === 'TURN_ON'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-surface hover:bg-sidebar text-text border border-line'
                              }`}
                            >
                              Bật nguồn (ON)
                            </button>
                            <button
                              type="button"
                              onClick={() => updateAction(index, { action: 'TURN_OFF', value: '' })}
                              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                action.action === 'TURN_OFF'
                                  ? 'bg-slate-700 text-white shadow-xs'
                                  : 'bg-surface hover:bg-sidebar text-text border border-line'
                              }`}
                            >
                              Tắt nguồn (OFF)
                            </button>
                            <button
                              type="button"
                              onClick={() => updateAction(index, { action: 'TOGGLE', value: '' })}
                              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                action.action === 'TOGGLE'
                                  ? 'bg-primary text-white shadow-xs'
                                  : 'bg-surface hover:bg-sidebar text-text border border-line'
                              }`}
                            >
                              Đảo bật/tắt
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 2. BRIGHTNESS (SET_BRIGHTNESS) */}
                      {action.action === 'SET_BRIGHTNESS' && (
                        <div className="space-y-2 rounded-xl bg-sidebar/50 border border-line p-3">
                          <div className="flex items-center justify-between text-xs font-bold text-text">
                            <span className="flex items-center gap-1.5">
                              <Sun size={14} className="text-amber-500" />
                              <span>Cài đặt độ sáng:</span>
                            </span>
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg border bg-amber-500/10 text-amber-700 border-amber-300">
                              {action.value || '50'}%
                            </span>
                          </div>

                          <div className="flex items-center gap-3 pt-1">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={1}
                              value={action.value || '50'}
                              onChange={(e) => updateAction(index, { value: e.target.value })}
                              className="flex-1 accent-amber-500 cursor-pointer h-2 bg-sidebar rounded-lg"
                            />
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={action.value || '50'}
                              onChange={(e) =>
                                updateAction(index, {
                                  value: String(Math.max(0, Math.min(100, Number(e.target.value)))),
                                })
                              }
                              className="w-16 rounded-xl border border-line px-2 py-1 text-xs text-center font-bold bg-surface text-text"
                            />
                          </div>

                          {/* Quick Presets */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {[
                              { label: '25% (Ngủ)', val: '25' },
                              { label: '50% (Dịu)', val: '50' },
                              { label: '75% (Chuẩn)', val: '75' },
                              { label: '100% (Sáng)', val: '100' },
                            ].map((p) => (
                              <button
                                key={p.val}
                                type="button"
                                onClick={() => updateAction(index, { value: p.val })}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                  action.value === p.val
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-surface hover:bg-sidebar text-text border border-line'
                                }`}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 3. COLOR RGB (SET_RGB / SET_COLOR) */}
                      {(action.action === 'SET_RGB' || action.action === 'SET_COLOR') && (
                        <div className="space-y-2 rounded-xl bg-sidebar/50 border border-line p-3">
                          <div className="flex items-center justify-between text-xs font-bold text-text">
                            <span className="flex items-center gap-1.5">
                              <Palette size={14} className="text-primary" />
                              <span>Chọn màu sắc đèn RGB:</span>
                            </span>
                            <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                              <span
                                className="w-4 h-4 rounded-full border border-black/20"
                                style={{ backgroundColor: action.value || '#ffc107' }}
                              />
                              <span className="uppercase text-text">
                                {action.value || '#ffc107'}
                              </span>
                            </div>
                          </div>

                          {/* Color Swatches Grid */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {COLOR_PRESETS.map((c) => {
                              const isSelected =
                                (action.value || '#ffc107').toLowerCase() === c.hex.toLowerCase();
                              return (
                                <button
                                  key={c.hex}
                                  type="button"
                                  onClick={() => updateAction(index, { value: c.hex })}
                                  className="w-7 h-7 rounded-full border border-black/20 flex items-center justify-center transition-transform hover:scale-110 cursor-pointer"
                                  style={{ backgroundColor: c.hex }}
                                  title={c.label}
                                >
                                  {isSelected && (
                                    <Check size={12} className="text-white drop-shadow stroke-[3]" />
                                  )}
                                </button>
                              );
                            })}

                            <label className="flex items-center gap-1.5 cursor-pointer bg-surface px-2.5 py-1 rounded-xl border border-line hover:border-primary">
                              <input
                                type="color"
                                value={action.value || '#ffc107'}
                                onChange={(e) => updateAction(index, { value: e.target.value })}
                                className="w-5 h-5 cursor-pointer bg-transparent border-0 p-0"
                              />
                              <span className="text-[10px] text-muted font-bold">Tùy chọn</span>
                            </label>
                          </div>
                        </div>
                      )}

                      {/* 4. TEMPERATURE (SET_TEMPERATURE) */}
                      {action.action === 'SET_TEMPERATURE' && (
                        <div className="space-y-2 rounded-xl bg-sidebar/50 border border-line p-3">
                          <div className="flex items-center justify-between text-xs font-bold text-text">
                            <span className="flex items-center gap-1.5">
                              <Thermometer size={14} className="text-primary" />
                              <span>Nhiệt độ mục tiêu:</span>
                            </span>
                            <span className="font-bold text-primary text-xs">
                              {action.value || '24'}°C
                            </span>
                          </div>

                          <div className="flex items-center justify-center gap-3 py-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateAction(index, {
                                  value: String(Math.max(16, Number(action.value || '24') - 1)),
                                })
                              }
                              className="w-9 h-9 rounded-xl border border-line bg-surface font-extrabold text-base hover:bg-sidebar text-text active:scale-95 transition-all cursor-pointer"
                            >
                              -
                            </button>
                            <span className="text-2xl font-black text-text min-w-[70px] text-center">
                              {action.value || '24'}°C
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateAction(index, {
                                  value: String(Math.min(32, Number(action.value || '24') + 1)),
                                })
                              }
                              className="w-9 h-9 rounded-xl border border-line bg-surface font-extrabold text-base hover:bg-sidebar text-text active:scale-95 transition-all cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 5. SPEED (SET_SPEED) */}
                      {action.action === 'SET_SPEED' && (
                        <div className="space-y-2 rounded-xl bg-sidebar/50 border border-line p-3">
                          <div className="flex items-center justify-between text-xs font-bold text-text">
                            <span className="flex items-center gap-1.5">
                              <Fan size={14} className="text-primary" />
                              <span>Tốc độ quạt (%):</span>
                            </span>
                            <span className="font-bold text-primary text-xs">
                              {action.value || '50'}%
                            </span>
                          </div>

                          <div className="flex items-center gap-3 pt-1">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={1}
                              value={action.value || '50'}
                              onChange={(e) => updateAction(index, { value: e.target.value })}
                              className="flex-1 accent-primary cursor-pointer h-2 bg-sidebar rounded-lg"
                            />
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={action.value || '50'}
                              onChange={(e) =>
                                updateAction(index, {
                                  value: String(Math.max(0, Math.min(100, Number(e.target.value)))),
                                })
                              }
                              className="w-16 rounded-xl border border-line px-2 py-1 text-xs text-center font-bold bg-surface text-text"
                            />
                          </div>
                        </div>
                      )}

                      {/* 6. ADVANCED JSON (SET_STATE) */}
                      {action.action === 'SET_STATE' && (
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-muted">
                            Trạng thái nâng cao (JSON):
                          </label>
                          <textarea
                            rows={3}
                            required
                            value={action.value}
                            onChange={(e) => updateAction(index, { value: e.target.value })}
                            placeholder='{"power": "ON", "brightness": 80}'
                            className="w-full rounded-xl border border-line bg-surface p-2.5 font-mono text-xs text-text focus:border-primary focus:outline-none"
                          />
                        </div>
                      )}

                      {/* 7. OTHER TEXT / CUSTOM KIND */}
                      {selectedOption?.valueKind === 'text' && (
                        <div>
                          <label className="block text-[11px] font-bold text-muted mb-1">
                            {selectedOption.valueLabel || 'Giá trị tham số'}
                          </label>
                          <input
                            required
                            value={action.value}
                            onChange={(e) => updateAction(index, { value: e.target.value })}
                            className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-text focus:border-primary focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-line">
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    (triggerType !== 'SCHEDULE' && !conditions.length) ||
                    !actions.length ||
                    actions.some((item) =>
                      item.action === 'EXECUTE_SCENE'
                        ? !availableScenes.some((s) => s.id === item.sceneId)
                        : !getDeviceActions(devices.find((d) => d.id === item.deviceId)).some(
                            (opt) => opt.code === item.action,
                          ),
                    )
                  }
                  className="w-full py-3 px-4 rounded-2xl bg-primary text-white font-bold text-xs hover:bg-primary-hover active:scale-98 transition-all duration-200 shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Đang lưu quy tắc...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>{editingRule ? 'Lưu thay đổi quy tắc' : 'Kích hoạt quy tắc tự động'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>

      {/* Delete Rule Confirmation Modal */}
      {ruleToDelete && (
        <ConfirmModal
          isOpen={true}
          title="Xóa quy tắc tự động"
          description={`Bạn có chắc chắn muốn xóa quy tắc “${ruleToDelete.name}”? Hành động này không thể hoàn tác.`}
          confirmText="Xóa quy tắc"
          cancelText="Hủy"
          variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setRuleToDelete(null)}
        />
      )}
    </div>
  );
}

function parseValue(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}
