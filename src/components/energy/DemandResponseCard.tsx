import React, { useState, useEffect } from 'react';
import {
  TrendingDown,
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

  const fetchSettings = async () => {
    try {
      const data = await getDemandResponseSettings(homeId);
      setSettings(data);
      setSliderWatts(data.peakThresholdWatts || 4000);
      setMode(data.mode || 'AUTO_SHED');
    } catch {
      // Quiet fail if homeId not ready
    }
  };

  useEffect(() => {
    if (homeId) {
      fetchSettings();
    }
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
        'Đã lưu cài đặt chống quá tải điện',
        `Hạn mức an toàn: ${sliderWatts}W (${(sliderWatts / 1000).toFixed(1)} kW) - Chế độ: ${
          mode === 'AUTO_SHED' ? 'Tự động ngắt thiết bị phụ' : 'Chỉ gửi cảnh báo'
        }`
      );
    } catch {
      notify.error('Không thể lưu cài đặt hạn mức điện');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSimulatePeak = async (simulatedWatts = 5500) => {
    setIsEvaluating(true);
    try {
      const evalRes = await evaluateDemandResponse(homeId, simulatedWatts);
      setResult(evalRes);
      if (evalRes.status === 'PEAK_SHEDDING_EXECUTED') {
        notify.success(
          'Đã kích hoạt bảo vệ chống quá tải!',
          `Đã tự động tắt ${evalRes.sheddedDevices.length} thiết bị phụ, giúp giảm ngay ${evalRes.wattsSaved}W.`
        );
      } else {
        notify.info(evalRes.message);
      }
    } catch {
      notify.error('Lỗi khi chạy thử nghiệm tình huống quá tải');
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="glass-card glass-g2 p-5 sm:p-6 rounded-3xl border border-[var(--border)] shadow-xs space-y-6">
      {/* Tiêu Đề & Nút Thử Nghiệm */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[var(--border)]/60">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 shrink-0 mt-0.5 border border-amber-500/20">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-[var(--text)]">
                Chống Quá Tải &amp; Giảm Tải Giờ Cao Điểm
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Bảo vệ Aptomat (CB)
              </span>
            </div>
            <p className="text-xs text-[var(--secondary)] mt-1 leading-relaxed max-w-2xl">
              Tự động giảm tải thiết bị phụ khi tổng công suất vượt ngưỡng an toàn, ngăn ngừa sập nguồn và tối ưu hóa đơn EVN.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleSimulatePeak(5500)}
          disabled={isEvaluating}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold transition-all shadow-sm hover:shadow disabled:opacity-50 shrink-0 cursor-pointer"
        >
          <Zap className={`w-4 h-4 fill-current ${isEvaluating ? 'animate-bounce' : ''}`} />
          {isEvaluating ? 'Đang chạy mô phỏng...' : 'Thử nghiệm quá tải (5.5 kW)'}
        </button>
      </div>

      {/* 4 Cấp Độ Ưu Tiên Thiết Bị */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-[var(--secondary)] uppercase tracking-wider block">
          Thứ tự ưu tiên cắt tải khi vượt ngưỡng
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Cấp 1 */}
          <div className="p-3.5 rounded-xl bg-red-500/5 border border-red-500/20 text-xs flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-bold">
                <Flame className="w-4 h-4 shrink-0" />
                <span>1. An Toàn Khẩn Cấp</span>
              </div>
              <p className="text-[11px] text-[var(--secondary)] mt-1">Báo cháy, gas, khóa cửa, chuông</p>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md w-fit">
              <ShieldCheck className="w-3 h-3" />
              Không bao giờ ngắt
            </div>
          </div>

          {/* Cấp 2 */}
          <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold">
                <Snowflake className="w-4 h-4 shrink-0" />
                <span>2. Sinh Hoạt Cốt Lõi</span>
              </div>
              <p className="text-[11px] text-[var(--secondary)] mt-1">Tủ lạnh, Wi-Fi, Camera an ninh</p>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md w-fit">
              <ShieldCheck className="w-3 h-3" />
              Duy trì 24/7
            </div>
          </div>

          {/* Cấp 3 */}
          <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
                <Sliders className="w-4 h-4 shrink-0" />
                <span>3. Tiện Nghi Công Suất Lớn</span>
              </div>
              <p className="text-[11px] text-[var(--secondary)] mt-1">Điều hòa, bình nước nóng, máy sưởi</p>
            </div>
            <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md w-fit">
              Tạm ngắt đợt 2 (khi cần)
            </div>
          </div>

          {/* Cấp 4 */}
          <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center gap-1.5 text-primary font-bold">
                <Tv className="w-4 h-4 shrink-0" />
                <span>4. Phụ Trợ &amp; Trang Trí</span>
              </div>
              <p className="text-[11px] text-[var(--secondary)] mt-1">Đèn hắt, trang trí, ổ cắm phụ</p>
            </div>
            <div className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md w-fit">
              Ngắt đợt 1 ngay lập tức
            </div>
          </div>
        </div>
      </div>

      {/* Cài Đặt Hạn Mức An Toàn & Chế Độ Hoạt Động */}
      <div className="p-4 sm:p-5 rounded-xl bg-[var(--solid)] border border-[var(--border)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--text)]">Hạn Mức Công Suất An Toàn:</span>
              <span className="text-primary text-base font-extrabold font-mono">
                {sliderWatts} W ({(sliderWatts / 1000).toFixed(1)} kW)
              </span>
            </div>
            <p className="text-[11px] text-[var(--secondary)] mt-0.5">
              Khuyến nghị: 3.500W – 4.500W cho căn hộ thông thường.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-[var(--g1)] p-1 rounded-xl border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setMode('AUTO_SHED')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  mode === 'AUTO_SHED'
                    ? 'bg-primary text-white shadow-xs font-bold'
                    : 'text-[var(--secondary)] hover:text-[var(--text)]'
                }`}
              >
                Tự Động Cắt Tải
              </button>
              <button
                type="button"
                onClick={() => setMode('ALERT_ONLY')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  mode === 'ALERT_ONLY'
                    ? 'bg-amber-500 text-white shadow-xs font-bold'
                    : 'text-[var(--secondary)] hover:text-[var(--text)]'
                }`}
              >
                Chỉ Báo Động
              </button>
            </div>

            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--text)] hover:bg-[var(--g1)] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Đang lưu...' : 'Lưu Hạn Mức'}
            </button>
          </div>
        </div>

        <input
          type="range"
          min="1500"
          max="8000"
          step="250"
          value={sliderWatts}
          onChange={(e) => setSliderWatts(Number(e.target.value))}
          className="w-full accent-[var(--accent)] cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-[var(--secondary)] font-medium">
          <span>Tiết kiệm (1.5 kW)</span>
          <span>Hộ gia đình (3.5 – 4.5 kW)</span>
          <span>Cực đại (8.0 kW)</span>
        </div>
      </div>

      {/* Kết Quả Thử Nghiệm Tình Huống Quá Tải */}
      {result && (
        <div
          className={`p-4 rounded-xl border transition-all ${
            result.status === 'PEAK_SHEDDING_EXECUTED'
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-amber-500/10 border-amber-500/30'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {result.status === 'PEAK_SHEDDING_EXECUTED' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              )}
              <div>
                <h5 className="text-sm font-bold text-[var(--text)]">
                  {result.status === 'PEAK_SHEDDING_EXECUTED'
                    ? 'Đã xử lý chống quá tải thành công!'
                    : result.message}
                </h5>
                <p className="text-[11px] text-[var(--secondary)] mt-0.5">
                  Công suất thử nghiệm: <span className="text-[var(--text)] font-bold font-mono">{result.totalCurrentWatts}W</span> — Hạn mức: <span className="text-[var(--text)] font-bold font-mono">{result.peakThresholdWatts}W</span>
                </p>
              </div>
            </div>

            <span className="text-xs font-mono font-bold px-3 py-1 rounded-lg bg-[var(--solid)] text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs w-fit">
              Giảm ngay: -{result.wattsSaved} W
            </span>
          </div>

          {result.sheddedDevices.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--border)]/50 text-xs">
              <span className="text-[var(--secondary)] block mb-1.5 font-medium">
                Thiết bị phụ được tự động tạm ngắt:
              </span>
              <div className="flex flex-wrap gap-2">
                {result.sheddedDevices.map((dev, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--solid)] text-[var(--text)] font-medium border border-[var(--border)] text-xs"
                  >
                    <Power className="w-3 h-3 text-red-500" />
                    <span>{dev}</span>
                    <span className="text-[10px] text-red-600 dark:text-red-400 font-bold bg-red-500/10 px-1 py-0.5 rounded">Tạm ngắt</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
