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

  const hasSimulation = result !== null || activeSimWatts !== null;
  const displayWatts = result?.totalCurrentWatts ?? activeSimWatts ?? 0;
  const thresholdLoadPercent = sliderWatts > 0 ? (displayWatts / sliderWatts) * 100 : 0;
  const gaugeWidthPercent = Math.min(100, Math.max(0, (displayWatts / MAX_WATTS) * 100));
  const thresholdMarkerPercent = Math.min(98, Math.max(2, (sliderWatts / MAX_WATTS) * 100));
  const sliderPct = Math.min(100, Math.max(0, ((sliderWatts - MIN_WATTS) / (MAX_WATTS - MIN_WATTS)) * 100));
  const isOverload = hasSimulation && displayWatts > sliderWatts;

  return (
    <div className="bg-white/95 p-5 sm:p-7 rounded-3xl border border-[#cbd5e1] shadow-sm space-y-6 tabular-nums">
      {/* ── 1. Top Header & Action Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#e2e8f0]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#fffbeb] text-[#d97706] flex items-center justify-center shrink-0 border border-[#f59e0b]/45 shadow-xs">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-[#0f172a] tracking-tight">
                Bảo Vệ Quá Tải Aptomat
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  isOverload
                    ? 'bg-[#fff1f2] text-[#be123c] border-[#f43f5e]/50 animate-pulse'
                    : 'bg-[#ecfdf5] text-[#047857] border-[#10b981]/45'
                }`}
              >
                {isOverload
                  ? 'Cảnh Báo Quá Tải'
                  : hasSimulation
                    ? 'Hệ Thống An Toàn'
                    : 'Chế độ sẵn sàng'}
              </span>
            </div>
            <p className="text-xs text-[#475569] mt-0.5">
              Tự ngắt phụ tải điện khi công suất vượt ngưỡng an toàn để chống sập nguồn
            </p>
          </div>
        </div>

        {/* Action presets for quick simulation */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-[#475569] hidden md:inline">
            Thử nghiệm:
          </span>
          <button
            type="button"
            onClick={() => handleSimulatePeak(5500)}
            disabled={isEvaluating}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border ${
              activeSimWatts === 5500 && isEvaluating
                ? 'bg-[#d97706] text-white border-[#b45309] ring-2 ring-[#f59e0b]/40'
                : 'bg-[#fffbeb] text-[#b45309] hover:bg-[#fef3c7] border-[#f59e0b]/55'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Thử 5.5 kW</span>
          </button>

          <button
            type="button"
            onClick={() => handleSimulatePeak(6800)}
            disabled={isEvaluating}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border ${
              activeSimWatts === 6800 && isEvaluating
                ? 'bg-[#e11d48] text-white border-[#be123c] ring-2 ring-[#f43f5e]/40'
                : 'bg-[#fff1f2] text-[#be123c] hover:bg-[#ffe4e6] border-[#f43f5e]/50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Thử quá tải 6.8 kW</span>
          </button>
        </div>
      </div>

      {/* ── 2. Visual Power Gauge / Meter Card (Trực quan hóa công suất) ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center p-5 rounded-2xl bg-[#f8fafc] border border-[#cbd5e1] shadow-2xs">
        {/* Left: Dynamic Capacity Meter */}
        <div className="md:col-span-7 space-y-3">
          <div className="flex items-baseline justify-between text-xs gap-2 flex-wrap">
            <span className="text-[#475569] font-semibold flex items-center gap-1.5">
              <span>Công suất phụ tải tức thời:</span>
              <strong className="text-sm font-extrabold text-[#0f172a] font-mono">
                {displayWatts >= 1000 ? `${(displayWatts / 1000).toFixed(2)} kW` : `${displayWatts} W`}
              </strong>
              {!hasSimulation && (
                <span className="text-[11px] font-medium text-[#64748b]">
                  (Chưa chạy thử nghiệm)
                </span>
              )}
            </span>
            <span className="text-[11px] font-bold font-mono text-[#334155]">
              {thresholdLoadPercent.toFixed(0)}% ngưỡng ngắt
            </span>
          </div>

          {/* Scaled 0 -> 8.0 kW Track with aligned threshold marker */}
          <div className="w-full h-3.5 bg-[#e2e8f0] rounded-full overflow-hidden border border-[#cbd5e1] relative">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isOverload
                  ? 'bg-gradient-to-r from-[#d97706] to-[#e11d48]'
                  : thresholdLoadPercent >= 75
                  ? 'bg-gradient-to-r from-[#059669] to-[#d97706]'
                  : 'bg-[#059669]'
              }`}
              style={{ width: `${gaugeWidthPercent}%` }}
            />
            <div
              aria-hidden="true"
              title={`Ngưỡng ngắt: ${(sliderWatts / 1000).toFixed(1)} kW`}
              className="absolute top-0 bottom-0 w-0.5 bg-[#1d4ed8]"
              style={{ left: `${thresholdMarkerPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#475569] font-mono">
            <span>0 kW</span>
            <span className="font-bold text-[#1d4ed8]">
              Ngưỡng ngắt: {(sliderWatts / 1000).toFixed(1)} kW ({sliderWatts}W)
            </span>
            <span>8.0 kW</span>
          </div>
        </div>

        {/* Right: Aptomat Status Capsule */}
        <div className="md:col-span-5 flex flex-col justify-center sm:border-l sm:border-[#cbd5e1] sm:pl-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#475569] font-medium">Bảo vệ CB:</span>
            <span className="text-xs font-bold text-[#047857] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Sẵn sàng
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#475569] font-medium">Chế độ xử lý:</span>
            <span className="text-xs font-bold text-[#1d4ed8] font-mono">
              {mode === 'AUTO_SHED' ? 'Tự ngắt tải' : 'Chỉ cảnh báo'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#475569] font-medium">Định mức an toàn:</span>
            <span className="text-xs font-extrabold text-[#0f172a] font-mono">
              {(sliderWatts / 1000).toFixed(1)} kW
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. Visual Priority Strip (Thanh cấp độ ưu tiên trực quan - Không văn dài) ── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#334155] uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-[#2563eb]" />
            Cấp Độ Ưu Tiên Cắt Tải
          </span>
          <span className="text-[11px] text-[#475569]">
            Tự động bảo vệ thiết bị cốt lõi
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Cấp 1 */}
          <div className="p-3 rounded-2xl bg-[#fff1f2] border border-[#f43f5e]/45 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#ffe4e6] text-[#be123c] border border-[#f43f5e]/35 flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-[#0f172a] truncate">Khẩn Cấp</div>
              <span className="text-[10px] font-bold text-[#be123c] block truncate">
                Cấm ngắt 100%
              </span>
            </div>
          </div>

          {/* Cấp 2 */}
          <div className="p-3 rounded-2xl bg-[#eff6ff] border border-[#3b82f6]/45 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#dbeafe] text-[#1d4ed8] border border-[#3b82f6]/35 flex items-center justify-center shrink-0">
              <Snowflake className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-[#0f172a] truncate">Cốt Lõi</div>
              <span className="text-[10px] font-bold text-[#1d4ed8] block truncate">
                Duy trì 24/7
              </span>
            </div>
          </div>

          {/* Cấp 3 */}
          <div className="p-3 rounded-2xl bg-[#fffbeb] border border-[#f59e0b]/50 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#fef3c7] text-[#b45309] border border-[#f59e0b]/35 flex items-center justify-center shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-[#0f172a] truncate">Công Suất Lớn</div>
              <span className="text-[10px] font-bold text-[#b45309] block truncate">
                Ngắt đợt 2 (Điều hòa)
              </span>
            </div>
          </div>

          {/* Cấp 4 */}
          <div className="p-3 rounded-2xl bg-[#f5f3ff] border border-[#8b5cf6]/45 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#ede9fe] text-[#6d28d9] border border-[#8b5cf6]/35 flex items-center justify-center shrink-0">
              <Tv className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-[#0f172a] truncate">Phụ Trợ</div>
              <span className="text-[10px] font-bold text-[#6d28d9] block truncate">
                Ngắt đầu tiên (Đèn)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Cài Đặt Hạn Mức An Toàn & Chế Độ ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#f8fafc] border border-[#cbd5e1] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-[#0f172a]">Ngưỡng Bảo Vệ:</span>
            <span className="text-lg font-black text-[#1d4ed8] font-mono">
              {(sliderWatts / 1000).toFixed(1)} kW ({sliderWatts}W)
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode switch */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-[#cbd5e1]">
              <button
                type="button"
                onClick={() => setMode('AUTO_SHED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mode === 'AUTO_SHED'
                    ? 'bg-[#2563eb] text-white shadow-xs'
                    : 'text-[#475569] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
                }`}
              >
                Tự Động Ngắt
              </button>
              <button
                type="button"
                onClick={() => setMode('ALERT_ONLY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mode === 'ALERT_ONLY'
                    ? 'bg-[#d97706] text-white shadow-xs'
                    : 'text-[#475569] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu'}</span>
            </button>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-[#475569] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#d97706]" />
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
                  ? 'bg-[#2563eb] text-white border-[#2563eb] shadow-xs'
                  : 'bg-white text-[#334155] border-[#cbd5e1] hover:border-[#94a3b8] hover:text-[#0f172a]'
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
            aria-label="Ngưỡng bảo vệ công suất quá tải"
            className="w-full energy-range-slider cursor-pointer"
            style={{
              background: `linear-gradient(to right, #2563eb ${sliderPct}%, #cbd5e1 ${sliderPct}%)`,
            }}
          />
          <div className="flex justify-between text-[10px] text-[#64748b] font-mono pt-1.5">
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
                ? 'bg-[#ecfdf5] border-[#10b981]/45'
                : 'bg-[#fffbeb] border-[#f59e0b]/50'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {result.status === 'PEAK_SHEDDING_EXECUTED' ? (
                  <CheckCircle2 className="w-5 h-5 text-[#047857] shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-[#b45309] shrink-0" />
                )}
                <div>
                  <h5 className="text-sm font-bold text-[#0f172a]">
                    {result.status === 'PEAK_SHEDDING_EXECUTED'
                      ? 'Đã ngắt tải bảo vệ thành công!'
                      : (result.message || 'Cảnh báo phụ tải')}
                  </h5>
                  <p className="text-xs text-[#475569] mt-0.5">
                    Công suất thử nghiệm:{' '}
                    <strong className="text-[#0f172a] font-mono">
                      {(currentW / 1000).toFixed(1)} kW ({currentW}W)
                    </strong>
                  </p>
                </div>
              </div>

              {savedW > 0 && (
                <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-white text-[#047857] border border-[#10b981]/40 shadow-xs w-fit">
                  Hạ tải ngay: -{(savedW / 1000).toFixed(2)} kW (-{savedW}W)
                </span>
              )}
            </div>

            {sheddedDevices.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#cbd5e1] text-xs">
                <span className="text-[#475569] block mb-2 font-medium">
                  Thiết bị được tự động tạm ngắt:
                </span>
                <div className="flex flex-wrap gap-2">
                  {sheddedDevices.map((dev, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white text-[#0f172a] font-semibold border border-[#cbd5e1] text-xs shadow-2xs"
                    >
                      <Power className="w-3.5 h-3.5 text-[#e11d48]" />
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
