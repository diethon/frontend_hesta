import React, { useState, useEffect } from 'react';
import {
  TrendingDown,
  ShieldCheck,
  Zap,
  Play,
  RotateCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Snowflake,
  Tv,
  Power,
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
  const [settings, setSettings] = useState<DemandResponseSettings | null>(null);
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
      notify.success('Đã lưu cài đặt Cắt Tải Đỉnh', `Hạn mức: ${sliderWatts}W, Chế độ: ${mode}`);
    } catch {
      notify.error('Lỗi khi lưu cài đặt Demand Response');
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
        notify.success('Cắt tải đỉnh thành công!', `Đã ngắt ${evalRes.sheddedDevices.length} thiết bị, tiết kiệm ${evalRes.wattsSaved}W`);
      } else {
        notify.info(evalRes.message);
      }
    } catch {
      notify.error('Lỗi khi kích hoạt đánh giá cắt tải');
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="surface-card p-6 gentle-rise border-primary/20 bg-gradient-to-br from-surface via-surface to-primary/5 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-text">
              Cắt Tải Đỉnh Thông Minh (Demand Response &amp; Peak Shaving)
            </h3>
            <p className="text-xs text-muted">
              Tự động sa thải phụ tải (Load Shedding) theo 4 cấp độ ưu tiên khi công suất chạm đỉnh
            </p>
          </div>
        </div>

        <button
          onClick={() => handleSimulatePeak(5500)}
          disabled={isEvaluating}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
        >
          <Zap className={`w-4 h-4 fill-current ${isEvaluating ? 'animate-bounce' : ''}`} />
          {isEvaluating ? 'Đang Xử Lý Cắt Tải...' : '⚡ Giả Lập Quá Tải 5500W'}
        </button>
      </div>

      {/* 4 Priority Tier Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs">
          <div className="flex items-center gap-1.5 text-red-500 font-bold mb-1">
            <Flame className="w-4 h-4" /> 1. SAFETY (An Toàn)
          </div>
          <p className="text-[11px] text-muted">Báo khói, rò rỉ gas, khóa cửa</p>
          <strong className="text-[10px] text-red-600 uppercase font-mono block mt-1">Khóa an toàn 100%</strong>
        </div>

        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs">
          <div className="flex items-center gap-1.5 text-blue-500 font-bold mb-1">
            <Snowflake className="w-4 h-4" /> 2. ESSENTIAL (Thiết Yếu)
          </div>
          <p className="text-[11px] text-muted">Tủ lạnh, Router WiFi, Camera</p>
          <strong className="text-[10px] text-blue-600 uppercase font-mono block mt-1">Không bao giờ cắt</strong>
        </div>

        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
          <div className="flex items-center gap-1.5 text-amber-500 font-bold mb-1">
            <Sliders className="w-4 h-4" /> 3. COMFORT (Tiện Nghi)
          </div>
          <p className="text-[11px] text-muted">Điều hòa, Bình nóng lạnh, Quạt</p>
          <strong className="text-[10px] text-amber-600 uppercase font-mono block mt-1">Tiết giảm đợt 2</strong>
        </div>

        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs">
          <div className="flex items-center gap-1.5 text-primary font-bold mb-1">
            <Tv className="w-4 h-4" /> 4. LUXURY (Xa Xỉ)
          </div>
          <p className="text-[11px] text-muted">Đèn chùm, Đèn trang trí, Ổ cắm phụ</p>
          <strong className="text-[10px] text-primary uppercase font-mono block mt-1">Cắt tức thì đợt 1</strong>
        </div>
      </div>

      {/* Threshold Slider & Mode Controls */}
      <div className="p-4 rounded-2xl bg-surface border border-line space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-text flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" />
              Ngưỡng Giới Hạn Công Suất Đỉnh: <span className="text-primary text-base font-mono">{sliderWatts} W</span>
            </span>
            <p className="text-[11px] text-muted">Kéo thanh trượt để điều chỉnh ngưỡng cắt tải của hộ gia đình</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('AUTO_SHED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                mode === 'AUTO_SHED'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-sidebar text-muted hover:text-text'
              }`}
            >
              Tự Động Cắt Tải
            </button>
            <button
              onClick={() => setMode('ALERT_ONLY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                mode === 'ALERT_ONLY'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-sidebar text-muted hover:text-text'
              }`}
            >
              Chỉ Cảnh Báo
            </button>

            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="px-3.5 py-1.5 rounded-xl border border-line text-xs font-bold text-text hover:bg-sidebar transition-colors disabled:opacity-50"
            >
              Lưu Cài Đặt
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
          className="w-full accent-primary"
        />
      </div>

      {/* Simulation Result Box */}
      {result && (
        <div
          className={`p-4 rounded-2xl border transition-all ${
            result.status === 'PEAK_SHEDDING_EXECUTED'
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-amber-500/10 border-amber-500/30'
          }`}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              {result.status === 'PEAK_SHEDDING_EXECUTED' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              )}
              <h5 className="text-sm font-bold text-text">{result.message}</h5>
            </div>

            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-surface text-text border border-line">
              Tiết kiệm: -{result.wattsSaved} W
            </span>
          </div>

          {result.sheddedDevices.length > 0 && (
            <div className="mt-3 pt-3 border-t border-line/50 text-xs">
              <span className="text-muted block mb-1">Các thiết bị đã được tự động sa thải phụ tải:</span>
              <div className="flex flex-wrap gap-1.5">
                {result.sheddedDevices.map((dev, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface text-text font-medium border border-line text-xs shadow-xs"
                  >
                    <Power className="w-3 h-3 text-red-500" />
                    {dev}
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
