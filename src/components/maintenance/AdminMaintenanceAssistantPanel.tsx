import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bot, Power, RefreshCw, ShieldAlert } from 'lucide-react';
import {
  adminGetAssistantMetrics,
  adminGetAssistantStatus,
  adminSetAssistantKillSwitch,
} from '../../services/maintenanceApi';
import type { AdminAssistantMetrics, AdminAssistantStatus } from '../../types/maintenance';
import { getErrorMessage } from '../../utils/errors';
import { notify } from '../ui/notify';
import { btnDanger, btnGhost, btnPrimary, fieldClass } from './MaintenanceModal';

const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

export function AdminMaintenanceAssistantPanel() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toDateStr(d);
  });
  const [toDate, setToDate] = useState(() => toDateStr(new Date()));

  const [metrics, setMetrics] = useState<AdminAssistantMetrics | null>(null);
  const [status, setStatus] = useState<AdminAssistantStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const fromIso = fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : undefined;
      const toIso = toDate ? new Date(`${toDate}T23:59:59`).toISOString() : undefined;
      const [m, st] = await Promise.all([
        adminGetAssistantMetrics(fromIso, toIso),
        adminGetAssistantStatus(),
      ]);
      setMetrics(m);
      setStatus(st);
    } catch (error) {
      notify.error(getErrorMessage(error, 'Không tải được dữ liệu Trợ lý AI.'));
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleToggleKillSwitch = async () => {
    if (!status || busy) return;
    setBusy(true);
    try {
      const next = !status.killSwitchActive;
      await adminSetAssistantKillSwitch(next);
      notify.success(next ? 'Đã BẬT công tắc khẩn cấp — tạm dừng mọi LLM' : 'Đã TẮT công tắc khẩn cấp');
      await loadAll();
    } catch (error) {
      notify.error(getErrorMessage(error, 'Không đổi được trạng thái công tắc khẩn cấp.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-muted block">Từ ngày</span>
          <input type="date" className={fieldClass} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-muted block">Đến ngày</span>
          <input type="date" className={fieldClass} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
        <button type="button" className={btnGhost} onClick={() => void loadAll()} disabled={loading}>
          <RefreshCw className="w-4 h-4" /> Cập nhật số liệu
        </button>
        {status && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted">
              AI mặc định: <strong>{status.aiConfigEnabled ? 'BẬT' : 'TẮT'}</strong>
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleToggleKillSwitch()}
              className={status.killSwitchActive ? btnPrimary : btnDanger}
            >
              <Power className="w-4 h-4" />
              {status.killSwitchActive ? 'Tắt công tắc khẩn cấp' : 'Kill Switch (Dừng LLM ngay)'}
            </button>
          </div>
        )}
      </section>

      {/* Red alerts */}
      {metrics && (metrics.alerts.highMisleadingRate || metrics.alerts.highFallbackRate || metrics.alerts.safetySpike) && (
        <section role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-4 space-y-1.5 text-sm text-rose-800">
          <div className="flex items-center gap-2 font-bold">
            <ShieldAlert className="w-4 h-4 shrink-0" /> Cảnh báo chất lượng / vận hành Trợ lý AI
          </div>
          {metrics.alerts.highMisleadingRate && (
            <p>• Tỷ lệ chẩn đoán đánh giá <strong>Gây hiểu nhầm (MISLEADING)</strong> đang ở mức <strong>{metrics.misleadingRate}%</strong> (&gt; 20%).</p>
          )}
          {metrics.alerts.highFallbackRate && (
            <p>• Tỷ lệ <strong>Fallback LLM</strong> (lỗi / 429 / hết quota) đang ở mức <strong>{metrics.llmFallbackRate}%</strong> (&gt; 30%).</p>
          )}
          {metrics.alerts.safetySpike && (
            <p>• Nhánh <strong>An toàn / CAUTION</strong> tăng đột biến: <strong>{metrics.alerts.safetyCurrentCount}</strong> lượt so với <strong>{metrics.alerts.safetyPreviousCount}</strong> lượt kỳ trước.</p>
          )}
        </section>
      )}

      {loading && !metrics && <div className="h-40 animate-pulse rounded-2xl bg-sidebar" />}

      {metrics && (
        <>
          {/* KPI strip */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Tỷ lệ tự giải quyết" value={`${metrics.selfResolutionRate}%`}
              sub={`RESOLVED: ${metrics.conversationsByStatus.RESOLVED ?? 0} · ESCALATED: ${metrics.conversationsByStatus.ESCALATED ?? 0} · ABANDONED: ${metrics.conversationsByStatus.ABANDONED ?? 0}`} />
            <KpiCard label="Ticket Chatbot / Thủ công" value={`${metrics.ticketsBySource.CHATBOT ?? 0} / ${metrics.ticketsBySource.MANUAL ?? 0}`}
              sub={`Admin đánh giá: Hữu ích ${metrics.chatbotTicketsByQuality.HELPFUL ?? 0} · 1 phần ${metrics.chatbotTicketsByQuality.PARTIAL ?? 0} · Sai lệch ${metrics.chatbotTicketsByQuality.MISLEADING ?? 0}`} />
            <KpiCard label="LLM Fallback / Low Conf." value={`${metrics.llmFallbackRate}% / ${metrics.llmLowConfidenceRate}%`}
              sub={`Tổng lượt gọi: ${metrics.llmTotalAttempts} · Token TB/phiên: ${metrics.avgTokensPerConversation}${metrics.estimatedCostUsd != null ? ` · ~$${metrics.estimatedCostUsd}` : ''}`} />
            <KpiCard label="Hài lòng người dùng (👍/👎)" value={`${metrics.userPositiveRate}%`}
              sub={`👍 ${metrics.userRatingPositive} · 👎 ${metrics.userRatingNegative} · Mất mạng diện rộng: ${metrics.homeWideOutageCount}`} />
          </section>

          {/* Breakdown grids */}
          <section className="grid gap-4 lg:grid-cols-3">
            {/* Safety & CAUTION */}
            <div className="rounded-2xl border border-line bg-surface p-4 space-y-2">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Nhánh an toàn &amp; CAUTION
              </h3>
              <ul className="text-xs space-y-1.5 text-muted">
                <li className="flex justify-between"><span>Chặn Lớp 1 (regex/từ khóa)</span><strong className="text-text">{metrics.safetyLayer1Count}</strong></li>
                <li className="flex justify-between"><span>Cảnh báo Lớp 2 (LLM)</span><strong className="text-text">{metrics.safetyLayer2Count}</strong></li>
                <li className="flex justify-between"><span>Hỏi xác nhận CAUTION</span><strong className="text-text">{metrics.cautionPromptedCount}</strong></li>
                <li className="flex justify-between"><span>CAUTION → Có / Không / Không chắc</span>
                  <strong className="text-text">{metrics.cautionAnswers.YES ?? 0} / {metrics.cautionAnswers.NO ?? 0} / {metrics.cautionAnswers.UNSURE ?? 0}</strong>
                </li>
              </ul>
            </div>

            {/* Image analysis */}
            <div className="rounded-2xl border border-line bg-surface p-4 space-y-2">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-primary" /> Phân tích ảnh AI
              </h3>
              <ul className="text-xs space-y-1.5 text-muted">
                <li className="flex justify-between"><span>Số ảnh đã phân tích</span><strong className="text-text">{metrics.imagesAnalyzedCount}</strong></li>
                <li className="flex justify-between"><span>Yêu cầu chụp lại</span><strong className="text-text">{metrics.imageRetakeCount} ({metrics.imageRetakeRate}%)</strong></li>
                <li className="flex justify-between"><span>Phát hiện người / giấy tờ</span><strong className="text-text">{metrics.imagePrivacyRejectCount} ({metrics.imagePrivacyRejectRate}%)</strong></li>
                <li className="flex justify-between"><span>Tổng token kỳ này</span><strong className="text-text">{metrics.totalTokens.toLocaleString('vi-VN')}</strong></li>
              </ul>
            </div>

            {/* Top device types & symptoms */}
            <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
              <h3 className="text-sm font-bold">Phân bố loại thiết bị &amp; triệu chứng</h3>
              <BarList items={metrics.deviceTypeDistribution.slice(0, 5)} emptyText="Chưa có dữ liệu thiết bị." />
              {metrics.topSymptoms.length > 0 && (
                <div className="pt-2 border-t border-line/60">
                  <p className="text-[11px] font-semibold text-muted mb-1.5">Triệu chứng phổ biến</p>
                  <BarList items={metrics.topSymptoms.slice(0, 5)} emptyText="" />
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 space-y-1">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[11px] text-muted">{sub}</p>
    </div>
  );
}

function BarList({ items, emptyText }: { items: Array<{ key: string; count: number }>; emptyText: string }) {
  if (items.length === 0) {
    return emptyText ? <p className="text-xs text-muted">{emptyText}</p> : null;
  }
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.key} className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span className="truncate font-mono">{item.key}</span>
            <strong>{item.count}</strong>
          </div>
          <div className="h-1.5 rounded-full bg-sidebar overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((item.count / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
