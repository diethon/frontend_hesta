import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import {
  Sparkles,
  Clock,
  Check,
  X,
  EyeOff,
  ChevronRight,
  Sliders,
  MapPin,
  Bot,
  Zap,
} from 'lucide-react';
import { getTopRecommendation, resolveRecommendation } from '../../services/recommendationApi';
import type { Recommendation } from '../../types/recommendation';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';

interface SpotlightRecommendationBannerProps {
  homeId?: string;
  onApplied?: () => void;
}

export const SpotlightRecommendationBanner: React.FC<SpotlightRecommendationBannerProps> = ({
  homeId,
  onApplied,
}) => {
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  const fetchTop = useCallback(async () => {
    if (!homeId) {
      setRecommendation(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const top = await getTopRecommendation(homeId);
      setRecommendation(top);
    } catch {
      // Gracefully swallow error so the dashboard stays functional
      setRecommendation(null);
    } finally {
      setLoading(false);
    }
  }, [homeId]);

  useEffect(() => {
    setDismissed(false);
    void fetchTop();
  }, [fetchTop]);

  const handleResolve = async (action: 'approve' | 'reject' | 'dismiss') => {
    if (!homeId || !recommendation) return;

    if (action === 'approve') {
      const confirmed = window.confirm(
        `Áp dụng thói quen này và thiết lập lịch tự động cho ${recommendation.deviceName || 'thiết bị'}?`
      );
      if (!confirmed) return;
    }

    setActionLoading(true);
    try {
      await resolveRecommendation(homeId, recommendation.id, action);
      if (action === 'approve') {
        notify.success('Đã tạo lịch tự động hóa thành công từ gợi ý thông minh!');
        if (onApplied) onApplied();
      } else if (action === 'reject') {
        notify.info('Đã ghi nhận phản hồi từ chối để tối ưu hóa mô hình AI.');
      } else {
        notify.info('Đã tạm thời bỏ qua gợi ý.');
      }
      setDismissed(true);
      setRecommendation(null);
    } catch (err: unknown) {
      notify.error(getErrorMessage(err, 'Không thể xử lý gợi ý'));
    } finally {
      setActionLoading(false);
    }
  };

  if (!homeId || dismissed) return null;

  if (loading) {
    return (
      <div className="w-full mb-6 p-4 rounded-3xl bg-surface/60 border border-line/60 backdrop-blur-md animate-pulse">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-line/40" />
            <div className="space-y-2">
              <div className="w-48 h-4 rounded-md bg-line/40" />
              <div className="w-72 h-3 rounded-md bg-line/30" />
            </div>
          </div>
          <div className="w-28 h-8 rounded-xl bg-line/30 hidden sm:block" />
        </div>
      </div>
    );
  }

  if (!recommendation) return null;

  const rawAction = recommendation.proposedAction?.action || 'TURN_ON';
  const isTurnOn = rawAction === 'TURN_ON' || rawAction === 'POWER_ON' || rawAction === 'OPEN';
  const actionLabel = isTurnOn ? 'Bật' : (rawAction === 'TURN_OFF' ? 'Tắt' : rawAction);

  const parameters = recommendation.proposedAction?.parameters || {};
  const hasParams = Object.keys(parameters).length > 0;
  const paramDisplay = hasParams
    ? Object.entries(parameters)
        .map(([k, v]) => `${k === 'temperature' ? 'Nhiệt độ' : k === 'brightness' ? 'Độ sáng' : k}: ${v}${k === 'temperature' ? '°C' : k === 'brightness' ? '%' : ''}`)
        .join(' • ')
    : null;

  const scheduledTime = recommendation.triggerCondition?.time
    ? recommendation.triggerCondition.time.slice(0, 5)
    : '07:00';

  const confidencePct = Math.round((recommendation.confidence || 0.8) * 100);

  return (
    <div
      role="region"
      aria-label="Đề xuất thói quen thông minh"
      className="relative overflow-hidden w-full mb-6 p-5 sm:p-6 rounded-3xl border border-primary/30 bg-gradient-to-r from-primary/10 via-surface/90 to-accent/10 shadow-lg backdrop-blur-md transition-all duration-300 hover:shadow-xl hover:border-primary/50"
    >
      {/* Decorative accent orb */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-primary/20 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
        {/* Left: AI Icon + Device/Room info + Description */}
        <div className="flex items-start gap-3.5 sm:gap-4 flex-1">
          <div className="p-3 rounded-2xl bg-primary text-white shadow-md shadow-primary/25 shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            {/* Top row: Badge and Confidence */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-primary/15 text-primary">
                <Bot className="w-3 h-3" />
                {recommendation.engineType === 'ML' ? 'AI Spotlight' : 'Gợi ý thông minh'}
              </span>

              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Zap className="w-3 h-3" />
                {confidencePct}% Tin cậy
              </span>

              {recommendation.roomName && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted">
                  <MapPin className="w-3 h-3" />
                  {recommendation.roomName}
                </span>
              )}
            </div>

            {/* Title: Action + Device Name + Time */}
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-text truncate">
                Tự động {actionLabel.toLowerCase()} <span className="text-primary">{recommendation.deviceName || 'thiết bị'}</span>
              </h3>

              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-sidebar text-text border border-line">
                <Clock className="w-3 h-3 text-primary" />
                {scheduledTime}
              </span>

              {paramDisplay && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-accent/10 text-accent">
                  <Sliders className="w-3 h-3" />
                  {paramDisplay}
                </span>
              )}
            </div>

            {/* AI Explanation */}
            <p className="text-xs text-secondary leading-relaxed line-clamp-2 sm:line-clamp-none max-w-3xl">
              {recommendation.explanation}
            </p>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2 self-end lg:self-center shrink-0 pt-2 lg:pt-0">
          <Link
            to={`/homes/${encodeURIComponent(homeId)}/recommendations`}
            className="text-xs font-semibold text-muted hover:text-text px-2.5 py-2 rounded-xl hover:bg-sidebar transition-colors hidden md:inline-flex items-center gap-1"
          >
            <span>Chi tiết</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>

          <button
            type="button"
            disabled={actionLoading}
            onClick={() => void handleResolve('dismiss')}
            className="p-2 sm:px-3 sm:py-2 text-xs font-medium rounded-xl border border-line bg-surface/70 text-muted hover:text-text hover:bg-sidebar transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            title="Tạm thời bỏ qua đề xuất này"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bỏ qua</span>
          </button>

          <button
            type="button"
            disabled={actionLoading}
            onClick={() => void handleResolve('reject')}
            className="p-2 sm:px-3 sm:py-2 text-xs font-medium rounded-xl border border-line bg-surface/70 text-muted hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-900 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            title="Từ chối gợi ý"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Từ chối</span>
          </button>

          <button
            type="button"
            disabled={actionLoading}
            onClick={() => void handleResolve('approve')}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-white hover:bg-primary-hover shadow-md hover:shadow-lg shadow-primary/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>Áp dụng</span>
          </button>
        </div>
      </div>
    </div>
  );
};
