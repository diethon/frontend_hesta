import React, { useState, useEffect } from 'react';
import {
  Zap,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Snowflake,
  Tv,
  Power,
  ShieldCheck,
  Save,
  Gauge,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import type { DemandResponseSettings, DemandResponseEvaluationResult } from '../../types/energy';
import {
  getDemandResponseSettings,
  updateDemandResponseSettings,
  evaluateDemandResponse,
} from '../../services/energyApi';
import { notify } from '../ui/notify';

interface DemandResponseCardProps {
  homeId: string;
}

export const DemandResponseCard: React.FC<DemandResponseCardProps> = ({ homeId }) => {
  const [, setSettings] = useState<DemandResponseSettings | null>(null);
  const [result, setResult] = useState<DemandResponseEvaluationResult | null>(null);
  const [sliderWatts, setSliderWatts] = useState(4000);
  const [mode, setMode] = useState<'AUTO_SHED' | 'ALERT_ONLY'>('AUTO_SHED');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSimWatts, setActiveSimWatts] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    if (!homeId) return;

    const fetchSettings = async () => {
      try {
        const data = await getDemandResponseSettings(homeId);
        if (!active) return;
        setSettings(data);
        setSliderWatts(data.peakThresholdWatts || 4000);
        setMode(data.mode || 'AUTO_SHED');
      } catch {
        // Quiet fail
      }
    };

    void fetchSettings();

    return () => {
      active = false;
    };
  }, [homeId]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const updated = await updateDemandResponseSettings(homeId, {
        peakThresholdWatts: sliderWatts,
        mode,
        enabled: true,
      });
      setSettings(updated);
      notify.success(
        'Đã lưu hạn mức an toàn',
        `Ngưỡng bảo vệ: ${(sliderWatts / 1000).toFixed(1)} kW · Chế độ: ${
          mode === 'AUTO_SHED' ? 'Tự động ngắt tải' : 'Chỉ gửi cảnh báo'
        }`
      );
    } catch {
      notify.error('Không thể lưu cài đặt hạn mức điện');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSimulatePeak = async (simulatedWatts: number) => {
    setIsEvaluating(true);
    setActiveSimWatts(simulatedWatts);
    try {
      const evalRes = await evaluateDemandResponse(homeId, simulatedWatts);
      setResult(evalRes);
      const shedCount = Array.isArray(evalRes?.sheddedDevices) ? evalRes.sheddedDevices.length : 0;
      const savedW = evalRes?.wattsSaved ?? 0;
      if (evalRes?.status === 'PEAK_SHEDDING_EXECUTED') {
        notify.success(
          'Aptomat tự ngắt tải bảo vệ!',
          `Đã ngắt ${shedCount} thiết bị phụ, hạ ngay ${savedW}W.`
        );
      } else {
        notify.info(evalRes?.message || 'Đã đánh giá phụ tải an toàn');
      }
    } catch {
      notify.error('Lỗi khi chạy thử nghiệm tình huống');
    } finally {
      setIsEvaluating(false);
    }
  };

  const MIN_WATTS = 1500;
  const MAX_WATTS = 8000;

  const displayWatts = result?.totalCurrentWatts ?? activeSimWatts ?? 20;
  const currentLoadPercent = Math.min(100, Math.max(2, (displayWatts / sliderWatts) * 100));
  const isOverload = displayWatts > sliderWatts;

  return (
    <div className="glass-card glass-g2 p-5 sm:p-7 rounded-3xl border border-[var(--border)] shadow-xs space-y-6 tabular-nums">
      {/* ── 1. Top Header & Action Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[var(--border)]/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/25 shadow-xs">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-[var(--text)] tracking-tight">
                Bảo Vệ Quá Tải Aptomat
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  isOverload
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse'
                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                }`}
              >
                {isOverload ? 'Cảnh Báo Quá Tải' : 'Hệ Thống An Toàn'}
              </span>
            </div>
            <p className="text-xs text-[var(--secondary)] mt-0.5">
              Tự ngắt phụ tải điện khi công suất vượt ngưỡng an toàn để chống sập nguồn
            </p>
          </div>
        </div>

        {/* Action presets for quick simulation */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-[var(--tertiary)] hidden md:inline">
            Thử nghiệm:
          </span>
          <button
            type="button"
            onClick={() => handleSimulatePeak(5500)}
            disabled={isEvaluating}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
              activeSimWatts === 5500 && isEvaluating
                ? 'bg-amber-600 text-white ring-2 ring-amber-400'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 border border-amber-500/30'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Thử 5.5 kW</span>
          </button>

          <button
            type="button"
            onClick={() => handleSimulatePeak(6800)}
            disabled={isEvaluating}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
              activeSimWatts === 6800 && isEvaluating
                ? 'bg-rose-600 text-white ring-2 ring-rose-400'
                : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25 border border-rose-500/30'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Thử quá tải 6.8 kW</span>
          </button>
        </div>
      </div>

      {/* ── 2. Visual Power Gauge / Meter Card (Trực quan hóa công suất) ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center p-5 rounded-2xl bg-[var(--solid)] border border-[var(--border)] shadow-xs">
        {/* Left: Dynamic Capacity Meter */}
        <div className="md:col-span-7 space-y-3">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-[var(--secondary)] font-semibold flex items-center gap-1.5">
              <span>Công suất phụ tải tức thời:</span>
              <strong className="text-sm font-extrabold text-[var(--text)] font-mono">
                {displayWatts >= 1000 ? `${(displayWatts / 1000).toFixed(2)} kW` : `${displayWatts} W`}
              </strong>
            </span>
            <span className="text-[11px] font-bold font-mono text-[var(--secondary)]">
              {currentLoadPercent.toFixed(0)}% định mức
            </span>
          </div>

          {/* Dual Multi-color Progress Gauge */}
          <div className="w-full h-3.5 bg-[var(--muted)] rounded-full overflow-hidden p-0.5 border border-[var(--border)] relative">
            <div
              className={`h-full rounded-full transition-all duration-500 shadow-sm ${
                currentLoadPercent >= 100
                  ? 'bg-gradient-to-r from-amber-500 to-rose-600'
                  : currentLoadPercent >= 75
                  ? 'bg-gradient-to-r from-emerald-500 to-amber-500'
                  : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
              }`}
              style={{ width: `${Math.min(currentLoadPercent, 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[var(--tertiary)] font-mono">
            <span>0 kW</span>
            <span className="font-bold text-[var(--accent)]">
              Ngưỡng ngắt: {(sliderWatts / 1000).toFixed(1)} kW ({sliderWatts}W)
            </span>
            <span>8.0 kW</span>
          </div>
        </div>

        {/* Right: Aptomat Status Capsule */}
        <div className="md:col-span-5 flex flex-col justify-center sm:border-l sm:border-[var(--border)] sm:pl-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--secondary)] font-medium">Bảo vệ CB:</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Sẵn sàng
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--secondary)] font-medium">Chế độ xử lý:</span>
            <span className="text-xs font-bold text-[var(--accent)] font-mono">
              {mode === 'AUTO_SHED' ? 'Tự ngắt tải' : 'Chỉ cảnh báo'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--secondary)] font-medium">Định mức an toàn:</span>
            <span className="text-xs font-extrabold text-[var(--text)] font-mono">
              {(sliderWatts / 1000).toFixed(1)} kW
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. Visual Priority Strip (Thanh cấp độ ưu tiên trực quan - Không văn dài) ── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[var(--secondary)] uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-[var(--accent)]" />
            Cấp Độ Ưu Tiên Cắt Tải
          </span>
          <span className="text-[11px] text-[var(--tertiary)]">
            Tự động bảo vệ thiết bị cốt lõi
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Cấp 1 */}
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-[var(--text)] truncate">Khẩn Cấp</div>
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block truncate">
                Cấm ngắt 100%
              </span>
            </div>
          </div>

          {/* Cấp 2 */}
          <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Snowflake className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-[var(--text)] truncate">Cốt Lõi</div>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 block truncate">
                Duy trì 24/7
              </span>
            </div>
          </div>

          {/* Cấp 3 */}
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-[var(--text)] truncate">Công Suất Lớn</div>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block truncate">
                Ngắt đợt 2 (Điều hòa)
              </span>
            </div>
          </div>

          {/* Cấp 4 */}
          <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Tv className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-[var(--text)] truncate">Phụ Trợ</div>
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 block truncate">
                Ngắt đầu tiên (Đèn)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Cài Đặt Hạn Mức An Toàn & Chế Độ ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--solid)] border border-[var(--border)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-[var(--text)]">Ngưỡng Bảo Vệ:</span>
            <span className="text-lg font-black text-[var(--accent)] font-mono">
              {(sliderWatts / 1000).toFixed(1)} kW ({sliderWatts}W)
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode switch */}
            <div className="flex items-center bg-[var(--g1)] p-1 rounded-xl border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setMode('AUTO_SHED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mode === 'AUTO_SHED'
                    ? 'bg-[var(--accent)] text-white shadow-xs'
                    : 'text-[var(--secondary)] hover:text-[var(--text)]'
                }`}
              >
                Tự Động Ngắt
              </button>
              <button
                type="button"
                onClick={() => setMode('ALERT_ONLY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mode === 'ALERT_ONLY'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-[var(--secondary)] hover:text-[var(--text)]'
                }`}
              >
                Chỉ Báo Động
              </button>
            </div>

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-bold hover:opacity-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu'}</span>
            </button>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-[var(--secondary)] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Mức khuyên dùng:
          </span>
          {[
            { label: '3.0 kW (Tiết kiệm)', val: 3000 },
            { label: '4.0 kW (Căn hộ)', val: 4000 },
            { label: '6.0 kW (Biệt thự)', val: 6000 },
          ].map((p) => (
            <button
              key={p.val}
              type="button"
              onClick={() => setSliderWatts(p.val)}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                sliderWatts === p.val
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                  : 'bg-[var(--g1)] text-[var(--secondary)] border-[var(--border)] hover:text-[var(--text)]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Range slider */}
        <div className="pt-2">
          <input
            type="range"
            min={MIN_WATTS}
            max={MAX_WATTS}
            step="250"
            value={sliderWatts}
            onChange={(e) => setSliderWatts(Number(e.target.value))}
            className="w-full accent-amber-500 h-2 bg-[var(--muted)] rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[var(--tertiary)] font-mono pt-1">
            <span>1.5 kW</span>
            <span>3.5 kW</span>
            <span>5.5 kW</span>
            <span>8.0 kW</span>
          </div>
        </div>
      </div>

      {/* ── 5. Kết Quả Thử Nghiệm Tình Huống (Simulation Feedback) ── */}
      {result && (() => {
        const sheddedDevices = Array.isArray(result?.sheddedDevices) ? result.sheddedDevices : [];
        const currentW = Number(result?.totalCurrentWatts ?? activeSimWatts ?? 0);
        const savedW = Number(result?.wattsSaved ?? 0);

        return (
          <div
            className={`p-4 rounded-2xl border transition-all ${
              result.status === 'PEAK_SHEDDING_EXECUTED'
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-amber-500/10 border-amber-500/30'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {result.status === 'PEAK_SHEDDING_EXECUTED' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <h5 className="text-sm font-bold text-[var(--text)]">
                    {result.status === 'PEAK_SHEDDING_EXECUTED'
                      ? 'Đã ngắt tải bảo vệ thành công!'
                      : (result.message || 'Cảnh báo phụ tải')}
                  </h5>
                  <p className="text-xs text-[var(--secondary)] mt-0.5">
                    Công suất thử nghiệm:{' '}
                    <strong className="text-[var(--text)] font-mono">
                      {(currentW / 1000).toFixed(1)} kW ({currentW}W)
                    </strong>
                  </p>
                </div>
              </div>

              {savedW > 0 && (
                <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-[var(--solid)] text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs w-fit">
                  Hạ tải ngay: -{(savedW / 1000).toFixed(2)} kW (-{savedW}W)
                </span>
              )}
            </div>

            {sheddedDevices.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--border)]/50 text-xs">
                <span className="text-[var(--secondary)] block mb-2 font-medium">
                  Thiết bị được tự động tạm ngắt:
                </span>
                <div className="flex flex-wrap gap-2">
                  {sheddedDevices.map((dev, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--solid)] text-[var(--text)] font-semibold border border-[var(--border)] text-xs shadow-2xs"
                    >
                      <Power className="w-3.5 h-3.5 text-rose-500" />
                      <span>{dev}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};
