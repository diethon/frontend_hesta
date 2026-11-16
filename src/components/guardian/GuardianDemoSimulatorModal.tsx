import React, { useState, useEffect } from 'react';
import { Icon } from '../ui/LucideIcon';
import type { ParentalGuardianRule, ParentalGuardianLog, SimulateEventType } from '../../types/guardian';
import { simulateGuardianEvent, getGuardianLogs } from '../../services/guardianApi';
import toast from 'react-hot-toast';

interface GuardianDemoSimulatorModalProps {
  rule: ParentalGuardianRule | null;
  onClose: () => void;
  onRuleUpdated: (updated: ParentalGuardianRule) => void;
}

export const GuardianDemoSimulatorModal: React.FC<GuardianDemoSimulatorModalProps> = ({
  rule,
  onClose,
  onRuleUpdated,
}) => {
  const [currentRule, setCurrentRule] = useState<ParentalGuardianRule | null>(rule);
  const [logs, setLogs] = useState<ParentalGuardianLog[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<number>(1);

  useEffect(() => {
    setCurrentRule(rule);
    if (rule) {
      loadLogs(rule.id, rule.homeId);
    }
  }, [rule]);

  const loadLogs = async (ruleId: string, homeId: string) => {
    try {
      const data = await getGuardianLogs(homeId, ruleId);
      setLogs(data.slice(0, 8));
    } catch {
      // Ignore
    }
  };

  if (!currentRule) return null;

  const handleRunStep = async (stepNum: number, eventType: SimulateEventType, stepName: string) => {
    setLoading(true);
    try {
      const updated = await simulateGuardianEvent(currentRule.homeId, currentRule.id, eventType);
      setCurrentRule(updated);
      onRuleUpdated(updated);
      setActiveStep(stepNum + 1);
      toast.success(`Đã thực thi: ${stepName}`);
      await loadLogs(updated.id, updated.homeId);
    } catch (err: any) {
      toast.error(`Lỗi mô phỏng: ${err.message || 'Không thể thực thi'}`);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      num: 1,
      title: 'Bước 1: Camera phát hiện người lớn rời nhà',
      desc: 'Hệ thống nhận diện vắng nhà và tự động kích hoạt chế độ Giám hộ con trẻ.',
      icon: 'door' as const,
      color: 'accent',
      eventType: 'PARENT_DEPARTURE' as SimulateEventType,
      btnText: 'Mô phỏng Phụ huynh rời nhà',
    },
    {
      num: 2,
      title: 'Bước 2: Bé ở nhà bắt đầu bật TV',
      desc: `TV được bật. Hệ thống gửi thông báo cho phụ huynh và bắt đầu đếm ngược ${currentRule.allowedDurationMinutes} phút.`,
      icon: 'zap' as const,
      color: 'accent',
      eventType: 'DEVICE_POWER_ON' as SimulateEventType,
      btnText: 'Mô phỏng Bé bật TV',
    },
    {
      num: 3,
      title: 'Bước 3: Hết giờ cho phép (Tua nhanh demo)',
      desc: 'Hết thời gian quy định. Hệ thống tự động phát lệnh cắt nguồn TV và kích hoạt khóa trẻ em.',
      icon: 'clock' as const,
      color: 'rose',
      eventType: 'FAST_FORWARD_EXPIRE' as SimulateEventType,
      btnText: 'Tua nhanh hết giờ (Cắt nguồn)',
    },
    {
      num: 4,
      title: 'Bước 4: Bé cố tình bấm bật lại công tắc (Chống lách luật)',
      desc: 'Thiết bị phát hiện trạng thái ON trái phép khi đang khóa -> Cưỡng chế ngắt nguồn ngay lập tức và gửi cảnh báo khẩn cấp!',
      icon: 'shield' as const,
      color: 'rose',
      eventType: 'TAMPER_POWER_ON' as SimulateEventType,
      btnText: 'Mô phỏng Bé cố bật lại (Cưỡng chế ngắt)',
    },
    {
      num: 5,
      title: 'Bước 5: Phụ huynh về nhà',
      desc: 'Camera AI nhận diện bố mẹ đã về nhà -> Chế độ giám hộ tạm dừng, mở khóa TV để sinh hoạt bình thường.',
      icon: 'home' as const,
      color: 'emerald',
      eventType: 'PARENT_ARRIVAL' as SimulateEventType,
      btnText: 'Mô phỏng Phụ huynh về nhà',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="glass-card glass-g2 w-full max-w-3xl rounded-3xl border border-[var(--border)] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <header className="p-5 border-b border-[var(--border)] bg-[var(--solid)]/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
              <Icon name="sparkles" size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold text-[var(--text)]">
                Bảng Giả Lập Thuyết Trình (Live Demo Simulator)
              </h2>
              <span className="text-xs text-[var(--secondary)]">
                Quy tắc: <strong className="text-[var(--text)]">{currentRule.name}</strong> (Thiết bị: {currentRule.targetDeviceName})
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[var(--border)] flex items-center justify-center text-[var(--secondary)] cursor-pointer"
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        {/* ── Content ── */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Status Live Banner */}
          <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-[var(--solid)]/70 border border-[var(--border)] text-xs">
            <div>
              <span className="text-[11px] text-[var(--tertiary)] block">Trạng thái phụ huynh</span>
              <span className={`font-bold text-xs mt-0.5 flex items-center gap-1 ${currentRule.parentAway ? 'text-amber-600' : 'text-emerald-600'}`}>
                <Icon name={currentRule.parentAway ? 'alert' : 'home'} size={13} />
                {currentRule.parentAway ? 'Vắng nhà (đang giám hộ)' : 'Ở nhà (tạm ngưng)'}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[var(--tertiary)] block">Trạng thái phiên</span>
              <span className={`font-bold text-xs mt-0.5 flex items-center gap-1 ${
                currentRule.status === 'LOCKED_OUT'
                  ? 'text-rose-600'
                  : currentRule.status === 'COUNTDOWN'
                  ? 'text-[var(--accent)]'
                  : currentRule.status === 'WARNING'
                  ? 'text-amber-600'
                  : 'text-[var(--secondary)]'
              }`}>
                <Icon
                  name={currentRule.status === 'LOCKED_OUT' ? 'lock' : currentRule.status === 'WARNING' ? 'alert' : currentRule.status === 'COUNTDOWN' ? 'clock' : 'check'}
                  size={13}
                />
                {currentRule.status === 'LOCKED_OUT'
                  ? 'Đã khóa thiết bị'
                  : currentRule.status === 'COUNTDOWN'
                  ? 'Đang đếm ngược'
                  : currentRule.status === 'WARNING'
                  ? 'Sắp hết giờ'
                  : 'Sẵn sàng'}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[var(--tertiary)] block">Hạn mức cài đặt</span>
              <span className="font-bold text-xs text-[var(--text)] mt-0.5 block">
                {currentRule.allowedDurationMinutes} phút
              </span>
            </div>
          </div>

          {/* Interactive Steps */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider block">
              Kịch bản 5 bước chứng minh giải pháp cho Hội đồng
            </span>

            <div className="space-y-2">
              {steps.map((st) => {
                const isCurrent = activeStep === st.num;
                return (
                  <div
                    key={st.num}
                    className={`rounded-2xl border p-3.5 transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      isCurrent
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/30 shadow-xs'
                        : 'border-[var(--border)] bg-[var(--solid)]/60 hover:bg-[var(--solid)]/90'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl bg-[var(--solid)] border border-[var(--border)] flex items-center justify-center shrink-0 font-bold text-xs text-[var(--text)] shadow-2xs">
                        {st.num}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-[var(--text)] flex items-center gap-1.5">
                          <Icon name={st.icon} size={13} className="text-[var(--accent)]" />
                          {st.title}
                        </h4>
                        <p className="text-[11px] text-[var(--secondary)] mt-0.5 max-w-lg leading-relaxed">
                          {st.desc}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleRunStep(st.num, st.eventType, st.title)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all shadow-xs cursor-pointer ${
                        st.color === 'rose'
                          ? 'bg-rose-500 hover:bg-rose-600 text-white'
                          : st.color === 'emerald'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-[var(--accent)] hover:opacity-90 text-white'
                      } disabled:opacity-50`}
                    >
                      {st.btnText}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Realtime Terminal Log */}
          <div className="space-y-1.5 pt-2 border-t border-[var(--border)]">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-[var(--secondary)] uppercase tracking-wider">
                Nhật ký phản hồi thời gian thực
              </span>
              <button
                type="button"
                onClick={() => loadLogs(currentRule.id, currentRule.homeId)}
                className="hover:text-[var(--text)] text-[11px] underline flex items-center gap-1 text-[var(--tertiary)] cursor-pointer"
              >
                <Icon name="refresh" size={11} /> Làm mới log
              </button>
            </div>
            <div className="bg-[#0f172a]/95 text-slate-100 font-mono text-xs p-3.5 rounded-2xl max-h-36 overflow-y-auto space-y-1 border border-slate-800 shadow-inner">
              {logs.length === 0 ? (
                <p className="text-slate-400 italic">Chưa có sự kiện trong phiên này.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="leading-relaxed">
                    <span className="text-slate-400">
                      [{new Date(log.recordedAt).toLocaleTimeString('vi-VN')}]
                    </span>{' '}
                    <span
                      className={`font-bold ${
                        log.eventType.includes('TAMPER') || log.eventType.includes('LOCKOUT')
                          ? 'text-rose-400'
                          : log.eventType.includes('STARTED')
                          ? 'text-sky-400'
                          : log.eventType.includes('ARRIVAL')
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      [{log.eventType}]
                    </span>{' '}
                    <span className="text-slate-200">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="p-4 border-t border-[var(--border)] bg-[var(--solid)]/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-[var(--solid)] border border-[var(--border)] text-[var(--secondary)] hover:text-[var(--text)] shadow-2xs transition-colors cursor-pointer"
          >
            Đóng bảng giả lập
          </button>
        </footer>
      </div>
    </div>
  );
};
