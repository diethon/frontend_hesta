import { confirmDialog } from '../ui/confirmDialog';
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useAppSelector } from '../../store/hooks';
import { AutomationTopBar } from '../automation/AutomationTopBar';
import { Icon } from '../ui/LucideIcon';
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

  // History modal
  const [logsModalRule, setLogsModalRule] = useState<ParentalGuardianRule | null>(null);
  const [logs, setLogs] = useState<ParentalGuardianLog[]>([]);
  const [logsLoading, setLogsLoading] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const fetchRules = (silent: boolean) =>
      getGuardianRules(homeId)
        .then((data) => {
          if (active) setRules(data);
        })
        .catch(() => {
          if (active && !silent) toast.error('Không thể tải danh sách quy tắc giám hộ');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    void fetchRules(false);
    // Refresh rule status every 10 seconds for real-time countdown sync
    const timer = setInterval(() => void fetchRules(true), 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [homeId]);

  const handleToggleEnabled = async (rule: ParentalGuardianRule) => {
    try {
      const updated = await toggleGuardianRule(homeId, rule.id, !rule.enabled);
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success(updated.enabled ? 'Đã bật quy tắc' : 'Đã tắt quy tắc');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi cập nhật trạng thái');
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi đổi chế độ vắng nhà');
    }
  };

  const handleExtend = async (rule: ParentalGuardianRule, extraMinutes: number) => {
    try {
      const updated = await extendGuardianSession(homeId, rule.id, extraMinutes);
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success(`Đã gia hạn thêm ${extraMinutes} phút`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi gia hạn');
    }
  };

  const handleUnlock = async (rule: ParentalGuardianRule) => {
    try {
      const updated = await unlockGuardianSession(homeId, rule.id);
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success('Đã mở khóa thiết bị thành công');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi mở khóa');
    }
  };

  const handleDelete = async (rule: ParentalGuardianRule) => {
    if (!await confirmDialog({ title: `Xóa quy tắc "${rule.name}"?`, description: 'Quy tắc giám sát này sẽ ngừng áp dụng ngay.', confirmText: 'Xóa quy tắc', variant: 'danger' })) return;
    try {
      await deleteGuardianRule(homeId, rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      toast.success('Đã xóa quy tắc');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi xóa quy tắc');
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

  useEffect(() => {
    if (!logsModalRule) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setLogsModalRule(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [logsModalRule]);

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

  const openCreate = () => {
    setEditingRule(null);
    setEditorOpen(true);
  };

  const caption = loading && rules.length === 0
    ? 'Đang tải quy tắc...'
    : `${rules.length} quy tắc · ${activeCount} đang bật · ${awayCount} vắng nhà${lockedCount ? ` · ${lockedCount} đang khóa` : ''}`;

  return (
    <>
      <AutomationTopBar
        caption={caption}
        title={<>Giám hộ con trẻ <span className="sr-only">Parental Screen-Time Guardian</span></>}
        subtitle="Giới hạn thời gian con dùng TV, máy tính hoặc ổ cắm khi bố mẹ vắng nhà."
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

        <div className="st-seg" role="tablist" aria-label="Lọc theo chế độ">
          {([
            { id: 'ALL', label: 'Mọi chế độ' },
            { id: 'AWAY', label: 'Đang vắng nhà' },
          ] as const).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={awayFilter === item.id}
              className={awayFilter === item.id ? 'active' : ''}
              onClick={() => setAwayFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="st-toolbar-end">
          <button
            type="button"
            className="st-link"
            onClick={() => navigate(homeId ? `/homes/${homeId}/automation-rules` : '/home')}
          >
            <Icon name="zap" />
            <span>Tự động hóa</span>
          </button>
          <button type="button" className="st-btn st-btn-primary" onClick={openCreate}>
            <Icon name="plus" size={18} />
            Tạo quy tắc giám hộ
          </button>
        </div>
      </div>

      {loading ? (
        <div className="st-circuits" aria-busy="true">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="st-skeleton st-circuit-skeleton" />
          ))}
        </div>
      ) : visibleRules.length === 0 ? (
        <div className="st-empty">
          <div className="st-empty-icon">
            <Icon name={rules.length === 0 ? 'shield' : 'search'} />
          </div>
          <h3>{rules.length === 0 ? 'Chưa có quy tắc giám hộ nào' : 'Chưa có quy tắc phù hợp'}</h3>
          <p>
            {rules.length === 0
              ? 'Đặt hạn mức dùng TV, máy tính hoặc ổ cắm cho con khi bố mẹ vắng nhà. Hết giờ, HESTA tự ngắt nguồn và chặn bật lại.'
              : 'Thử đổi bộ lọc trạng thái hoặc chế độ.'}
          </p>
          {rules.length === 0 ? (
            <button type="button" className="st-btn st-btn-primary" onClick={openCreate}>
              <Icon name="plus" size={18} />
              Tạo quy tắc đầu tiên
            </button>
          ) : (
            <button
              type="button"
              className="st-btn"
              onClick={() => {
                setStatusFilter('Tất cả');
                setAwayFilter('ALL');
              }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="st-circuits">
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
              onOpenLogs={handleOpenLogs}
            />
          ))}
        </div>
      )}

      {editorOpen && (
        <GuardianEditorModal
          homeId={homeId}
          initialRule={editingRule}
          onClose={() => setEditorOpen(false)}
          onSave={handleSaveRule}
        />
      )}

      {logsModalRule && (
        <div className="gd-overlay" onClick={() => setLogsModalRule(null)}>
          <div
            className="gd-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gd-logs-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="gd-head">
              <span className="gd-badge">
                <Icon name="clock" size={20} />
              </span>
              <div>
                <h2 id="gd-logs-title">Nhật ký giám hộ</h2>
                <p>{logsModalRule.name}</p>
              </div>
              <button type="button" className="st-icon-btn" onClick={() => setLogsModalRule(null)} aria-label="Đóng">
                <Icon name="x" size={18} />
              </button>
            </header>
            <div className="gd-body">
              {logsLoading ? (
                <p className="gd-hint">Đang tải nhật ký...</p>
              ) : logs.length === 0 ? (
                <p className="gd-hint">Chưa có sự kiện nào.</p>
              ) : (
                logs.map((log) => (
                  <article key={log.id} className="gd-log">
                    <header>
                      <span>{log.eventType}</span>
                      <time dateTime={log.recordedAt}>{new Date(log.recordedAt).toLocaleString('vi-VN')}</time>
                    </header>
                    <p>{log.message}</p>
                  </article>
                ))
              )}
            </div>
            <footer className="gd-foot">
              <p />
              <div>
                <button type="button" className="st-btn" onClick={() => setLogsModalRule(null)}>
                  Đóng
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  );
};
