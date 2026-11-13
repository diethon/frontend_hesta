import React, { useState, useEffect } from 'react';
import { Icon } from '../ui/LucideIcon';
import type { ParentalGuardianRule } from '../../types/guardian';

interface GuardianRuleCardProps {
  rule: ParentalGuardianRule;
  onToggleEnabled: (rule: ParentalGuardianRule) => void;
  onToggleAway: (rule: ParentalGuardianRule) => void;
  onExtend: (rule: ParentalGuardianRule, extraMinutes: number) => void;
  onUnlock: (rule: ParentalGuardianRule) => void;
  onDelete: (rule: ParentalGuardianRule) => void;
  onEdit: (rule: ParentalGuardianRule) => void;
  onOpenSimulate: (rule: ParentalGuardianRule) => void;
  onOpenLogs: (rule: ParentalGuardianRule) => void;
}

export const GuardianRuleCard: React.FC<GuardianRuleCardProps> = ({
  rule,
  onToggleEnabled,
  onToggleAway,
  onExtend,
  onUnlock,
  onDelete,
  onEdit,
  onOpenSimulate,
  onOpenLogs,
}) => {
  const [remaining, setRemaining] = useState<number>(rule.remainingSeconds || 0);

  useEffect(() => {
    setRemaining(rule.remainingSeconds || 0);
    if (rule.status !== 'COUNTDOWN' && rule.status !== 'WARNING') return;

    const timer = setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [rule.remainingSeconds, rule.status]);

  const formatRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalSeconds = rule.allowedDurationMinutes * 60;
  const progressPercent =
    totalSeconds > 0 ? Math.min(100, Math.max(0, ((totalSeconds - remaining) / totalSeconds) * 100)) : 0;

  const getStatusBadge = () => {
    switch (rule.status) {
      case 'COUNTDOWN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-ping" />
            {formatRemaining(remaining)}
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 border border-amber-500/30 shadow-2xs animate-pulse">
            <Icon name="alert" size={12} />
            Sắp hết giờ ({formatRemaining(remaining)})
          </span>
        );
      case 'LOCKED_OUT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-700 border border-rose-500/30 shadow-2xs">
            <Icon name="lock" size={12} />
            Đã khóa
          </span>
        );
      case 'IDLE':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[var(--solid)] text-[var(--secondary)] border border-[var(--border)] shadow-2xs">
            Sẵn sàng
          </span>
        );
    }
  };

  return (
    <article
      className={`scenario-card rule-card glass-g1 min-h-[220px] h-auto transition-all flex flex-col justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 ${
        rule.enabled ? 'on' : 'off'
      } ${rule.status === 'LOCKED_OUT' ? 'failed' : ''}`}
      onClick={() => onEdit(rule)}
    >
      {/* ── Top row: Icon bubble + Title + Toggle ── */}
      <div className="scenario-top">
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <span
            className={`scenario-icon w-10 h-10 rounded-2xl flex items-center justify-center transition-colors shrink-0 ${
              rule.status === 'LOCKED_OUT'
                ? 'bg-rose-500/15 text-rose-600'
                : rule.status === 'WARNING'
                ? 'bg-amber-500/15 text-amber-600'
                : rule.enabled
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'bg-[var(--muted)] text-[var(--secondary)]'
            }`}
          >
            <Icon name="shield" size={20} />
          </span>

          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[var(--text)] line-clamp-1 break-words">
              {rule.name}
            </h3>
            <div className="text-[11px] font-medium text-[var(--secondary)] flex items-center gap-1.5 mt-0.5 truncate">
              <span className="font-semibold text-[var(--text)]">{rule.targetDeviceName}</span>
              {rule.cameraDeviceName && (
                <>
                  <span>•</span>
                  <span className="text-[var(--tertiary)] flex items-center gap-1">
                    <Icon name="camera" size={12} />
                    {rule.cameraDeviceName}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {getStatusBadge()}
          <button
            type="button"
            aria-pressed={rule.enabled}
            onClick={(e) => {
              e.stopPropagation();
              onToggleEnabled(rule);
            }}
            className={`toggle ${rule.enabled ? 'active' : ''}`}
            title={rule.enabled ? 'Tắt quy tắc' : 'Bật quy tắc'}
          >
            <span />
          </button>
        </div>
      </div>

      {/* ── Active countdown box ── */}
      {(rule.status === 'COUNTDOWN' || rule.status === 'WARNING') && (
        <div className="my-2 p-3 rounded-2xl bg-[var(--solid)]/80 border border-[var(--border)] shadow-2xs">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[var(--secondary)] font-medium flex items-center gap-1">
              <Icon name="clock" size={12} className="text-[var(--accent)]" />
              Thời gian phiên
            </span>
            <span className="font-bold text-[var(--text)]">
              Còn <span className="text-[var(--accent)] font-mono text-sm">{formatRemaining(remaining)}</span> /{' '}
              {rule.allowedDurationMinutes}p
            </span>
          </div>
          <div className="w-full bg-[var(--muted)] rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                rule.status === 'WARNING'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-[var(--accent)]'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Locked Out Notice ── */}
      {rule.status === 'LOCKED_OUT' && (
        <div className="my-2 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-700 text-xs flex items-start gap-2">
          <Icon name="lock" size={15} className="shrink-0 mt-0.5 text-rose-600" />
          <div>
            <p className="font-bold text-rose-800">Đã cắt nguồn &amp; Khóa cưỡng chế</p>
            <p className="text-[11px] text-rose-700/90 mt-0.5 leading-relaxed">
              Đã hết {rule.allowedDurationMinutes} phút cho phép. Hệ thống tự động ngắt nguồn ngay nếu bé cố bật lại.
            </p>
          </div>
        </div>
      )}

      {/* ── Specs Row ── */}
      <div className="grid grid-cols-3 gap-2 py-2 border-y border-[var(--border)] text-xs text-[var(--secondary)] my-2">
        <div>
          <span className="text-[10px] uppercase font-bold text-[var(--tertiary)] block">Hạn mức</span>
          <span className="font-bold text-[var(--text)]">{rule.allowedDurationMinutes} phút</span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-[var(--tertiary)] block">Báo trước</span>
          <span className="font-bold text-[var(--text)]">{rule.warningMinutesBefore} phút</span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-[var(--tertiary)] block">Phụ huynh</span>
          <span className={`font-bold inline-flex items-center gap-1 ${rule.parentAway ? 'text-amber-600' : 'text-emerald-600'}`}>
            <Icon name={rule.parentAway ? 'alert' : 'home'} size={13} />
            {rule.parentAway ? 'Vắng nhà' : 'Ở nhà'}
          </span>
        </div>
      </div>

      {/* ── Bottom Action Row ── */}
      <div className="scenario-bottom pt-2 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Toggle away mode */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleAway(rule);
            }}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              rule.parentAway
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-700 hover:bg-amber-500/25'
                : 'bg-[var(--solid)] border-[var(--border)] text-[var(--secondary)] hover:text-[var(--text)]'
            }`}
            title="Đổi chế độ Vắng nhà / Ở nhà"
          >
            {rule.parentAway ? 'Vắng nhà (Bật)' : 'Ở nhà (Tạm ngưng)'}
          </button>

          {/* +15 min button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExtend(rule, 15);
            }}
            className="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30 hover:bg-[var(--accent)] hover:text-white transition-all cursor-pointer"
            title="Gia hạn thêm 15 phút"
          >
            +15p
          </button>

          {/* Unlock button */}
          {rule.status === 'LOCKED_OUT' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUnlock(rule);
              }}
              className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
            >
              Mở khóa
            </button>
          )}

          {/* Demo simulator button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSimulate(rule);
            }}
            className="px-3 py-1 rounded-full text-xs font-bold bg-[var(--solid)] border border-[var(--border)] text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
          >
            <Icon name="zap" size={11} /> Demo giả lập
          </button>

          {/* History button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenLogs(rule);
            }}
            className="p-1.5 rounded-full text-[var(--tertiary)] hover:text-[var(--text)] hover:bg-[var(--border)]/40 transition-colors cursor-pointer"
            title="Xem nhật ký giám hộ"
          >
            <Icon name="clock" size={14} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(rule);
            }}
            className="w-8 h-8 rounded-full hover:bg-[var(--border)] flex items-center justify-center text-[var(--secondary)] hover:text-[var(--text)] transition-colors cursor-pointer"
            title="Chỉnh sửa quy tắc"
          >
            <Icon name="pencil" size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(rule);
            }}
            className="w-8 h-8 rounded-full hover:bg-rose-500/15 flex items-center justify-center text-rose-500 transition-colors cursor-pointer"
            title="Xóa quy tắc"
          >
            <Icon name="trash" size={13} />
          </button>
        </div>
      </div>
    </article>
  );
};
