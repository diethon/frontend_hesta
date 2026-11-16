import React, { useState, useMemo, useEffect } from 'react';
import { Zap, Check, X, Pencil, Activity, Radio, AlertCircle } from 'lucide-react';
import { Icon } from '../../home/HomeIcons';
import type { DeviceEnergyBreakdown } from '../../../types/energy';
import type { DeviceUptimeResponse, DeviceHealthResponse, DeviceResponse } from '../../../types/device';
import type { FigmaDeviceType, DetailDeviceInput } from './detailTypes';
import { updateDeviceConfig } from '../../../services/deviceApi';
import { getDeviceEnergy, deviceEnergyKey } from '../../../services/energyApi';
import { peekCache } from '../../../services/queryCache';
import { notify } from '../../ui/notify';

export interface EnergyTabProps {
  device: DetailDeviceInput;
  resolvedType: FigmaDeviceType;
  disabled: boolean;
  wattage?: number;
  hasCustomWattage?: boolean;
  onSaveWattage?: (newWattage: number) => Promise<boolean>;
  energyData: DeviceEnergyBreakdown | null;
  uptimeData: DeviceUptimeResponse | null;
  healthData: DeviceHealthResponse | null;
  refreshEnergy: () => Promise<void>;
  onDeviceUpdated?: (updated: DeviceResponse) => void;
}

export const EnergyTab: React.FC<EnergyTabProps> = ({
  device,
  resolvedType,
  disabled,
  wattage: propWattage,
  hasCustomWattage: propHasCustomWattage,
  onSaveWattage,
  energyData,
  uptimeData,
  healthData,
  refreshEnergy,
  onDeviceUpdated,
}) => {
  const isGate = resolvedType === 'Cổng';
  const isSensor = resolvedType === 'Cảm biến';
  const isAc = resolvedType === 'Điều hòa';

  const devId = device?.raw?.id || device?.id;
  const [range, setRange] = useState<'7 ngày' | '30 ngày'>('30 ngày');
  const [periodEnergy, setPeriodEnergy] = useState<DeviceEnergyBreakdown | null>(() =>
    devId ? peekCache<DeviceEnergyBreakdown>(deviceEnergyKey(devId, '7D')) ?? null : null
  );

  useEffect(() => {
    if (!devId || range === '30 ngày') {
      return;
    }
    const cached = peekCache<DeviceEnergyBreakdown>(deviceEnergyKey(devId, '7D'));
    if (cached) {
      setPeriodEnergy(cached);
    }
    let cancelled = false;
    getDeviceEnergy(devId, '7D')
      .then((res) => {
        if (!cancelled && res) setPeriodEnergy(res);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [devId, range]);

  const activeEnergy = range === '7 ngày' && periodEnergy ? periodEnergy : energyData;

  // Wattage Configuration
  const rawCustomWattage = device?.raw?.settings?.wattage ?? device?.settings?.wattage;
  const currentWattage =
    propWattage !== undefined
      ? propWattage
      : rawCustomWattage !== undefined
      ? Number(rawCustomWattage)
      : (energyData?.wattage ?? (isAc ? 750 : isSensor ? 2 : 40));
  const hasCustomWattage =
    propHasCustomWattage !== undefined ? propHasCustomWattage : rawCustomWattage !== undefined;

  const [isEditingWattage, setIsEditingWattage] = useState(false);
  const [editWattage, setEditWattage] = useState(String(currentWattage));
  const [isSavingWattage, setIsSavingWattage] = useState(false);

  const handleStartEditWattage = () => {
    setEditWattage(String(currentWattage));
    setIsEditingWattage(true);
  };

  const handleCancelEditWattage = () => {
    setIsEditingWattage(false);
  };

  const handleSaveWattage = async () => {
    const targetId = device?.raw?.id || device?.id;
    if (!targetId) return;
    const trimmed = editWattage.trim();
    const parsedWatt = parseInt(trimmed, 10);
    if (!trimmed || Number.isNaN(parsedWatt) || parsedWatt <= 0 || parsedWatt > 25000) {
      notify.error('Vui lòng nhập công suất hợp lệ (1 – 25000 W)');
      return;
    }

    setIsSavingWattage(true);
    try {
      if (onSaveWattage) {
        const ok = await onSaveWattage(parsedWatt);
        if (ok) {
          setIsEditingWattage(false);
        }
        return;
      }

      const existingSettings = device?.raw?.settings || device?.settings || {};
      const updatedSettings = {
        ...existingSettings,
        wattage: parsedWatt,
      };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`hesta_wattage_${targetId}`, String(parsedWatt));
      }
      const updated = await updateDeviceConfig(targetId, {
        name: device?.raw?.name || device?.name,
        settings: updatedSettings,
      });
      setIsEditingWattage(false);
      notify.success(`Đã cập nhật công suất thành ${parsedWatt}W`);

      const cleanUpdated = {
        ...(device?.raw || {}),
        ...(updated || {}),
        id: targetId,
        homeId: updated?.homeId || device?.raw?.homeId || '',
        name: updated?.name || device?.raw?.name || device?.name || '',
        deviceType: updated?.deviceType || device?.raw?.deviceType || device?.deviceType || 'SWITCH',
        status: updated?.status || device?.raw?.status || 'ONLINE',
        currentState: updated?.currentState || device?.raw?.currentState || device?.currentState || {},
        settings: updatedSettings,
      } as DeviceResponse;
      onDeviceUpdated?.(cleanUpdated);
      void refreshEnergy();
    } catch (err) {
      console.warn('Update device wattage error:', err);
      notify.error('Lỗi khi cập nhật công suất thiết bị');
    } finally {
      setIsSavingWattage(false);
    }
  };

  const renderWattageEditorCard = () => (
    <div className="p-3 rounded-2xl bg-[var(--solid)] border border-[var(--border)] flex items-center justify-between gap-3 shadow-2xs">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-[var(--text)]">Công suất định mức</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                hasCustomWattage
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'bg-[var(--muted)] text-[var(--secondary)]'
              }`}
            >
              {hasCustomWattage ? 'Tùy chỉnh' : 'Mặc định'}
            </span>
          </div>
          <p className="text-[10px] text-[var(--secondary)] truncate">
            Dùng tính toán lượng điện tiêu thụ kWh và tiền điện EVN
          </p>
        </div>
      </div>

      {isEditingWattage ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="number"
            min={1}
            max={25000}
            value={editWattage}
            onChange={(e) => setEditWattage(e.target.value)}
            placeholder={String(currentWattage)}
            aria-label="Nhập công suất định mức (W)"
            className="w-20 px-2 py-1 text-right text-xs font-bold rounded-xl border border-[var(--accent)] bg-[var(--solid)] text-[var(--text)] outline-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSaveWattage();
              if (e.key === 'Escape') handleCancelEditWattage();
            }}
          />
          <span className="text-xs font-bold text-[var(--secondary)]">W</span>
          <button
            type="button"
            onClick={handleSaveWattage}
            disabled={isSavingWattage}
            className="px-2.5 py-1 rounded-xl bg-[var(--accent)] text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer flex items-center gap-1"
            title="Lưu công suất"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Lưu</span>
          </button>
          <button
            type="button"
            onClick={handleCancelEditWattage}
            className="p-1.5 rounded-xl border border-[var(--border)] text-[var(--secondary)] hover:text-[var(--text)] transition-colors cursor-pointer"
            title="Hủy"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <strong className="text-sm font-bold text-[var(--accent)]">{currentWattage} W</strong>
          <button
            type="button"
            onClick={handleStartEditWattage}
            className="px-2.5 py-1 rounded-xl border border-[var(--border)] bg-[var(--muted)] text-[var(--text)] hover:text-[var(--accent)] text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
            title="Tùy chỉnh công suất thiết bị"
          >
            <Pencil className="w-3 h-3 text-[var(--accent)]" />
            <span>Sửa</span>
          </button>
        </div>
      )}
    </div>
  );

  // Real share & runtime metrics from activeEnergy
  const sharePercent = Math.min(100, Math.max(0, Number(activeEnergy?.percentage ?? 0)));
  const onHoursPeriod = Number(activeEnergy?.totalOnHours ?? activeEnergy?.runtimeHours ?? 0);
  const daysInRange = range === '7 ngày' ? 7 : 30;
  const avgDailyKwh = (activeEnergy?.kwh ?? 0) / daysInRange;

  // 24-hr hour timeline
  const timelineMinutes = useMemo(() => {
    if (!uptimeData?.timelinePoints || uptimeData.timelinePoints.length === 0) {
      return Array(24).fill(0);
    }
    return uptimeData.timelinePoints.map((p) =>
      p.state === 'ON' ? Math.min(60, Math.round((p.durationSeconds || 0) / 60)) : 0
    );
  }, [uptimeData]);

  // If this is a Sensor or Gate, render Health/Signal Status + Wattage Editor
  if (isSensor || isGate) {
    return (
      <div className="detail-tab-panel" role="tabpanel" id="device-panel-energy" aria-labelledby="device-tab-energy">
        <section className="light-metric-card glass-g1">
          <header>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <strong>Tình trạng thiết bị</strong>
            </div>
            {healthData?.healthPercent !== undefined && (
              <span className="usage-chip">{healthData.healthPercent}%</span>
            )}
          </header>

          <div className="energy-stats">
            {isGate ? (
              <>
                <span>
                  <small>Tổng chu kỳ</small>
                  <strong>{healthData?.switchCycles ?? 0} <i>lần</i></strong>
                </span>
                <span>
                  <small>Độ bền ước tính</small>
                  <strong>{healthData?.healthPercent ?? 100} <i>%</i></strong>
                </span>
                <span>
                  <small>Công suất định mức</small>
                  <strong>{currentWattage} <i>W</i></strong>
                </span>
              </>
            ) : (
              <>
                <span>
                  <small>Nguồn / Pin</small>
                  {(() => {
                    const batteryVal = device?.raw?.currentState?.battery ?? device?.raw?.currentState?.batteryPercent ?? device?.currentState?.battery ?? device?.currentState?.batteryPercent;
                    if (batteryVal !== undefined && batteryVal !== null) {
                      return <strong>{Number(batteryVal)} <i>%</i></strong>;
                    }
                    return <strong>Nguồn DC</strong>;
                  })()}
                </span>
                <span>
                  <small>Tín hiệu sóng</small>
                  <strong>
                    {device?.raw?.currentState?.rssi ? `${device.raw.currentState.rssi} dBm` : 'Tốt'}
                  </strong>
                </span>
                <span>
                  <small>Công suất định mức</small>
                  <strong>{currentWattage} <i>W</i></strong>
                </span>
              </>
            )}
          </div>

          {renderWattageEditorCard()}

          <div className="p-3 rounded-2xl bg-[var(--solid)] border border-[var(--border)] space-y-2 mt-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text)]">
              <Radio className="w-4 h-4 text-emerald-500" />
              <span>Chẩn đoán phần cứng HESTA IoT</span>
            </div>
            <p className="text-[11px] text-[var(--secondary)] leading-relaxed">
              Thiết bị được giám sát liên tục theo chu kỳ nhịp tim 30s. Vi điều khiển nội bộ đang vận hành ổn định.
            </p>
            {healthData?.chatteringWarning && (
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Phát hiện dao động đóng cắt bất thường</span>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="detail-tab-panel" role="tabpanel" id="device-panel-energy" aria-labelledby="device-tab-energy">
      {/* 1. Main Energy Consumption Card */}
      <section className="light-metric-card glass-g1">
        <header>
          <div>
            <Icon name="energy" size={18} />
            <strong>Năng lượng tiêu thụ</strong>
          </div>
          <div className="detail-segments">
            {(['7 ngày', '30 ngày'] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={range === item ? 'active' : ''}
                onClick={() => setRange(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </header>

        {disabled && <p className="data-until">Thiết bị đang ngoại tuyến</p>}

        {/* 3 Metric readout */}
        <div className="energy-stats">
          <span>
            <small>Tiêu thụ ({range})</small>
            <strong>
              {activeEnergy?.kwh !== undefined
                ? activeEnergy.kwh.toLocaleString('vi-VN', { maximumFractionDigits: 1 })
                : '0'}{' '}
              <i>kWh</i>
            </strong>
          </span>
          <span>
            <small>Ước tính tiền</small>
            <strong>
              {activeEnergy?.costVnd !== undefined
                ? activeEnergy.costVnd.toLocaleString('vi-VN')
                : '0'}{' '}
              <i>đ</i>
            </strong>
          </span>
          <span>
            <small>Công suất định mức</small>
            <strong>
              {currentWattage} <i>W</i>
            </strong>
          </span>
        </div>

        {/* Wattage Configuration with Inline Editing */}
        {renderWattageEditorCard()}

        {/* Real Consumption Share & Daily Average */}
        <div className="p-3 rounded-2xl bg-[var(--solid)] border border-[var(--border)] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--secondary)]">Tỷ trọng điện toàn nhà ({range})</span>
            <strong className="font-mono font-bold text-[var(--text)]">
              {sharePercent.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%
            </strong>
          </div>
          <div className="w-full h-2 rounded-full bg-[var(--muted)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${Math.max(sharePercent > 0 ? 4 : 0, sharePercent)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[var(--secondary)] pt-0.5">
            <span>
              Thời gian bật: <b className="text-[var(--text)]">{onHoursPeriod.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ</b>
            </span>
            <span>
              TB ngày: <b className="text-[var(--text)]">{avgDailyKwh.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} kWh/ngày</b>
            </span>
          </div>
        </div>
      </section>

      {/* 2. Uptime and 24h Frequency Timeline */}
      <section className="light-metric-card glass-g1">
        <header>
          <div>
            <strong>Tần suất hoạt động 24h</strong>
            <small>Hôm nay</small>
          </div>
          {uptimeData?.uptimePercent !== undefined && (
            <span className="usage-chip">{uptimeData.uptimePercent}% thời gian bật</span>
          )}
        </header>

        <div className="usage-stats">
          <span>
            <small>Tổng thời gian</small>
            <b>{uptimeData?.totalHours ?? 168} giờ</b>
          </span>
          <span>
            <small>Thời gian bật</small>
            <b>{uptimeData?.onHours != null ? uptimeData.onHours.toFixed(1) : '0'} giờ</b>
          </span>
          <span>
            <small>Thời gian tắt</small>
            <b>{uptimeData?.offHours != null ? uptimeData.offHours.toFixed(1) : '0'} giờ</b>
          </span>
        </div>

        <div className="hour-timeline mt-2">
          {timelineMinutes.map((value, hour) => (
            <button
              type="button"
              key={hour}
              title={`${String(hour).padStart(2, '0')}:00 – ${String(hour + 1).padStart(2, '0')}:00 · ${value} phút bật`}
              style={{ opacity: value ? Math.max(0.25, value / 60) : 1 }}
              className={value ? 'active' : ''}
            />
          ))}
        </div>

        <div className="timeline-axis">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>23:00</span>
        </div>

        <p className="timeline-hint">Di chuột để xem số phút bật trong từng khung giờ</p>

        <div className="timeline-legend">
          <span>
            <i className="on" />
            Bật
          </span>
          <span>
            <i />
            Tắt
          </span>
        </div>
      </section>
    </div>
  );
};
