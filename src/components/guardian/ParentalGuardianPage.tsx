import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useAppSelector } from '../../store/hooks';
import { VoiceAssistantButton } from '../ui/VoiceAssistant';
import { NotificationBell } from '../notification/NotificationBell';
import { Icon } from '../home/HomeIcons';
import type { ParentalGuardianRule, ParentalGuardianLog, CreateGuardianRuleInput } from '../../types/guardian';
import {
  getGuardianRules,
  createGuardianRule,
  updateGuardianRule,
  toggleGuardianRule,
  deleteGuardianRule,
  toggleParentAway,
  extendGuardianSession,
  unlockGuardianSession,
  getGuardianLogs,
} from '../../services/guardianApi';
import { GuardianRuleCard } from './GuardianRuleCard';
import { GuardianEditorModal } from './GuardianEditorModal';
import { GuardianDemoSimulatorModal } from './GuardianDemoSimulatorModal';
import toast from 'react-hot-toast';

interface ParentalGuardianPageProps {
  homeId: string;
}

export const ParentalGuardianPage: React.FC<ParentalGuardianPageProps> = ({ homeId }) => {
  const navigate = useNavigate();
  const authUser = useAppSelector((state) => state.auth.user);
  const userInitial = authUser?.fullName?.charAt(0) || authUser?.email?.charAt(0) || 'U';

  const [rules, setRules] = useState<ParentalGuardianRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'Tất cả' | 'Đang bật' | 'Đang tắt'>('Tất cả');
  const [awayFilter, setAwayFilter] = useState<'ALL' | 'AWAY'>('ALL');

  // Modals
  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<ParentalGuardianRule | null>(null);
  const [simulatingRule, setSimulatingRule] = useState<ParentalGuardianRule | null>(null);

  // History modal
  const [logsModalRule, setLogsModalRule] = useState<ParentalGuardianRule | null>(null);
  const [logs, setLogs] = useState<ParentalGuardianLog[]>([]);
  const [logsLoading, setLogsLoading] = useState<boolean>(false);

  useEffect(() => {
    loadRules();
    // Refresh rule status every 10 seconds for real-time countdown sync
    const timer = setInterval(() => {
      loadRules(true);
    }, 10000);
    return () => clearInterval(timer);
  }, [homeId]);

  const loadRules = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getGuardianRules(homeId);
      setRules(data);
    } catch {
      if (!silent) toast.error('Không thể tải danh sách quy tắc giám hộ');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleToggleEnabled = async (rule: ParentalGuardianRule) => {
    try {
      const updated = await toggleGuardianRule(homeId, rule.id, !rule.enabled);
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success(updated.enabled ? 'Đã bật quy tắc' : 'Đã tắt quy tắc');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi cập nhật trạng thái');
    }
  };

  const handleToggleAway = async (rule: ParentalGuardianRule) => {
    try {
      const updated = await toggleParentAway(homeId, rule.id, !rule.parentAway);
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success(
        updated.parentAway
          ? 'Đã bật chế độ Vắng nhà (Kích hoạt giám hộ)'
          : 'Đã chuyển sang chế độ Ở nhà (Tạm ngưng giám hộ)'
      );
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi đổi chế độ vắng nhà');
    }
  };

  const handleExtend = async (rule: ParentalGuardianRule, extraMinutes: number) => {
    try {
      const updated = await extendGuardianSession(homeId, rule.id, extraMinutes);
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success(`Đã gia hạn thêm ${extraMinutes} phút`);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi gia hạn');
    }
  };

  const handleUnlock = async (rule: ParentalGuardianRule) => {
    try {
      const updated = await unlockGuardianSession(homeId, rule.id);
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success('Đã mở khóa thiết bị thành công');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi mở khóa');
    }
  };

  const handleDelete = async (rule: ParentalGuardianRule) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa quy tắc "${rule.name}"?`)) return;
    try {
      await deleteGuardianRule(homeId, rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      toast.success('Đã xóa quy tắc');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi xóa quy tắc');
    }
  };

  const handleSaveRule = async (input: CreateGuardianRuleInput) => {
    if (editingRule) {
      const updated = await updateGuardianRule(homeId, editingRule.id, {
        ...input,
        enabled: editingRule.enabled,
      });
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success('Đã cập nhật quy tắc');
    } else {
      const created = await createGuardianRule(homeId, input);
      setRules((prev) => [created, ...prev]);
      toast.success('Đã tạo quy tắc giám hộ mới');
    }
  };

  const handleOpenLogs = async (rule: ParentalGuardianRule) => {
    setLogsModalRule(rule);
    setLogsLoading(true);
    try {
      const data = await getGuardianLogs(homeId, rule.id);
      setLogs(data);
    } catch {
      toast.error('Không thể tải nhật ký');
    } finally {
      setLogsLoading(false);
    }
  };

  // Counts and filters
  const activeCount = useMemo(() => rules.filter((r) => r.enabled).length, [rules]);
  const awayCount = useMemo(() => rules.filter((r) => r.parentAway).length, [rules]);
  const lockedCount = useMemo(() => rules.filter((r) => r.status === 'LOCKED_OUT').length, [rules]);

  const visibleRules = useMemo(() => {
    return rules.filter((rule) => {
      if (statusFilter === 'Đang bật' && !rule.enabled) return false;
      if (statusFilter === 'Đang tắt' && rule.enabled) return false;
      if (awayFilter === 'AWAY' && !rule.parentAway) return false;
      return true;
    });
  }, [rules, statusFilter, awayFilter]);

  return (
    <div className="space-y-4">
      {/* ── TopBar matching HESTA standard ── */}
      <header className="topbar scenes-topbar">
        <div>
          <span className="text-xs text-[var(--secondary)] font-normal block mb-0.5">
            {rules.length} quy tắc · {activeCount} đang bật · {awayCount} vắng nhà
          </span>
          <h2>
            Giám hộ con trẻ <span className="sr-only">Parental Screen-Time Guardian</span>
          </h2>
        </div>
        <div className="top-actions">
          <VoiceAssistantButton />
          <NotificationBell />
          <div className="avatar">{userInitial}</div>
        </div>
      </header>

      {/* ── Action Row matching scenes-actions ── */}
      <div className="scenes-actions">
        {/* Left: Filter segmented control */}
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

          <div className="flex items-center gap-1 bg-[var(--solid)] p-1 rounded-full border border-[var(--border)] shadow-2xs">
            <button
              type="button"
              onClick={() => setAwayFilter('ALL')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                awayFilter === 'ALL'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-bold'
                  : 'text-[var(--secondary)] hover:text-[var(--text)]'
              }`}
            >
              Tất cả chế độ
            </button>
            <button
              type="button"
              onClick={() => setAwayFilter('AWAY')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                awayFilter === 'AWAY'
                  ? 'bg-amber-500/15 text-amber-700 font-bold'
                  : 'text-[var(--secondary)] hover:text-[var(--text)]'
              }`}
            >
              Đang vắng nhà
            </button>
          </div>
        </div>

        {/* Right actions */}
        <div className="scene-actions-right">
          <button
            type="button"
            className="scene-ghost"
            onClick={() => navigate(homeId ? `/homes/${homeId}/automation-rules` : '/home')}
          >
            ← Tự động hóa
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
            onClick={() => {
              setEditingRule(null);
              setEditorOpen(true);
            }}
          >
            + Tạo quy tắc giám hộ
          </button>
        </div>
      </div>

      {/* ── Summary Strip (StatChips) ── */}
      <div className="scene-summary">
        <span className="stat">{rules.length} quy tắc</span>
        <span className="stat">{activeCount} đang bật</span>
        <span className="stat">{awayCount} chế độ vắng nhà</span>
        {lockedCount > 0 && (
          <span className="stat text-rose-600 font-bold bg-rose-500/10 border-rose-500/25">
            {lockedCount} thiết bị đang khóa
          </span>
        )}
      </div>

      {/* ── Content Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <article
              key={i}
              className="scenario-card glass-g1 off animate-pulse min-h-[200px] flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-[var(--border)]" />
                <div className="w-11 h-6 rounded-full bg-[var(--border)]" />
              </div>
              <div className="space-y-2 py-3">
                <div className="h-4 bg-[var(--border)] rounded-md w-3/4" />
                <div className="h-3 bg-[var(--border)] rounded-md w-1/2" />
              </div>
              <div className="h-3 bg-[var(--border)] rounded-md w-1/3 pt-2" />
            </article>
          ))}
        </div>
      ) : visibleRules.length === 0 ? (
        <div className="glass-card glass-g1 p-10 rounded-3xl text-center border border-[var(--border)] max-w-xl mx-auto my-8">
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center mx-auto mb-3">
            <Icon name="shield" size={28} />
          </div>
          <h3 className="font-bold text-[var(--text)] text-base">
            {rules.length === 0 ? 'Chưa có quy tắc giám hộ nào' : 'Không tìm thấy quy tắc phù hợp'}
          </h3>
          <p className="text-xs text-[var(--secondary)] mt-1.5 mb-5 max-w-md mx-auto leading-relaxed">
            {rules.length === 0
              ? 'Tự động kiểm soát thời gian xem TV hoặc dùng thiết bị của trẻ em khi phụ huynh vắng nhà, ngắt nguồn cưỡng chế chống lách luật.'
              : 'Thử đổi bộ lọc sang "Tất cả" để xem toàn bộ danh sách quy tắc.'}
          </p>
          <button
            type="button"
            className="add-device mx-auto"
            onClick={() => {
              setEditingRule(null);
              setEditorOpen(true);
            }}
          >
            + Bắt đầu tạo quy tắc
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleRules.map((rule) => (
            <GuardianRuleCard
              key={rule.id}
              rule={rule}
              onToggleEnabled={handleToggleEnabled}
              onToggleAway={handleToggleAway}
              onExtend={handleExtend}
              onUnlock={handleUnlock}
              onDelete={handleDelete}
              onEdit={(r) => {
                setEditingRule(r);
                setEditorOpen(true);
              }}
              onOpenSimulate={(r) => setSimulatingRule(r)}
              onOpenLogs={handleOpenLogs}
            />
          ))}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {editorOpen && (
        <GuardianEditorModal
          homeId={homeId}
          initialRule={editingRule}
          onClose={() => setEditorOpen(false)}
          onSave={handleSaveRule}
        />
      )}

      {/* ── Demo Simulator Modal ── */}
      {simulatingRule && (
        <GuardianDemoSimulatorModal
          rule={simulatingRule}
          onClose={() => setSimulatingRule(null)}
          onRuleUpdated={(updated) => {
            setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setSimulatingRule(updated);
          }}
        />
      )}

      {/* ── Logs History Dialog (Glass-G2) ── */}
      {logsModalRule && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setLogsModalRule(null)}
        >
          <div
            className="glass-card glass-g2 w-full max-w-xl rounded-3xl border border-[var(--border)] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--solid)]/50">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
                  <Icon name="clock" size={16} />
                </span>
                <div>
                  <h3 className="font-bold text-[var(--text)] text-sm">
                    Nhật ký Giám hộ: {logsModalRule.name}
                  </h3>
                  <span className="text-[11px] text-[var(--secondary)]">Lịch sử sự kiện thời gian thực</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLogsModalRule(null)}
                className="w-8 h-8 rounded-full hover:bg-[var(--border)] flex items-center justify-center text-[var(--secondary)] cursor-pointer"
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-2.5">
              {logsLoading ? (
                <div className="py-8 text-center text-xs text-[var(--secondary)]">Đang tải nhật ký...</div>
              ) : logs.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--secondary)]">Chưa có sự kiện nào.</div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--solid)]/70 text-xs shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-bold text-[var(--accent)]">[{log.eventType}]</span>
                      <span className="text-[var(--tertiary)]">{new Date(log.recordedAt).toLocaleString('vi-VN')}</span>
                    </div>
                    <p className="text-[var(--text)] font-medium leading-relaxed">{log.message}</p>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3.5 border-t border-[var(--border)] bg-[var(--solid)]/50 flex justify-end">
              <button
                type="button"
                onClick={() => setLogsModalRule(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--solid)] border border-[var(--border)] text-[var(--secondary)] hover:text-[var(--text)] shadow-2xs transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
