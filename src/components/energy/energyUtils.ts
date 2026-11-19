import type { DeviceEnergyBreakdown, EnergySummary } from '../../types/energy';

export interface EvnTierDefinition {
  tier: number;
  label: string;
  rangeLabel: string;
  minKwh: number;
  maxKwh: number;
  capacityKwh: number;
  pricePerKwh: number; // VND before VAT
}

export const EVN_TIERS: readonly EvnTierDefinition[] = [
  {
    tier: 1,
    label: 'Bậc 1',
    rangeLabel: '0 – 50 kWh',
    minKwh: 0,
    maxKwh: 50,
    capacityKwh: 50,
    pricePerKwh: 1893,
  },
  {
    tier: 2,
    label: 'Bậc 2',
    rangeLabel: '51 – 100 kWh',
    minKwh: 50,
    maxKwh: 100,
    capacityKwh: 50,
    pricePerKwh: 1956,
  },
  {
    tier: 3,
    label: 'Bậc 3',
    rangeLabel: '101 – 200 kWh',
    minKwh: 100,
    maxKwh: 200,
    capacityKwh: 100,
    pricePerKwh: 2271,
  },
  {
    tier: 4,
    label: 'Bậc 4',
    rangeLabel: '201 – 300 kWh',
    minKwh: 200,
    maxKwh: 300,
    capacityKwh: 100,
    pricePerKwh: 2860,
  },
  {
    tier: 5,
    label: 'Bậc 5',
    rangeLabel: '301 – 400 kWh',
    minKwh: 300,
    maxKwh: 400,
    capacityKwh: 100,
    pricePerKwh: 3197,
  },
  {
    tier: 6,
    label: 'Bậc 6',
    rangeLabel: '> 400 kWh',
    minKwh: 400,
    maxKwh: Number.POSITIVE_INFINITY,
    capacityKwh: Number.POSITIVE_INFINITY,
    pricePerKwh: 3302,
  },
] as const;

export const VAT_RATE = 0.08;

export function formatVnd(val?: number): string {
  if (val === undefined || val === null || Number.isNaN(val)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Math.round(val));
}

export const formatCurrencyVnd = formatVnd;

export function formatKwh(val?: number, maxDecimals = 2): string {
  if (val === undefined || val === null || Number.isNaN(val)) return '0';
  return Number(val).toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

export function getTierColorClass(tier: number): {
  badge: string;
  border: string;
  accent: string;
  bgLight: string;
} {
  switch (tier) {
    case 1:
    case 2:
      return {
        badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        border: 'border-emerald-500/40',
        accent: 'text-emerald-500',
        bgLight: 'bg-emerald-500',
      };
    case 3:
    case 4:
      return {
        badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
        border: 'border-amber-500/40',
        accent: 'text-amber-500',
        bgLight: 'bg-amber-500',
      };
    case 5:
    case 6:
      return {
        badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
        border: 'border-rose-500/40',
        accent: 'text-rose-500',
        bgLight: 'bg-rose-500',
      };
    default:
      return {
        badge: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
        border: 'border-slate-500/40',
        accent: 'text-slate-500',
        bgLight: 'bg-slate-500',
      };
  }
}

export interface TierCostSplitItem {
  tier: number;
  label: string;
  rangeLabel: string;
  pricePerKwh: number;
  kwhInTier: number;
  costVndWithoutVat: number;
  costVndWithVat: number;
  isFilled: boolean;
  isCurrent: boolean;
}

export function computeEvnCostSplit(referenceKwh: number, currentTierNumber?: number): {
  tiers: TierCostSplitItem[];
  totalKwh: number;
  totalCostWithoutVat: number;
  totalCostWithVat: number;
  computedTier: number;
  progressInCurrentTier: number;
  kwhLeftToNextTier: number | null;
  nextTierPrice: number | null;
} {
  const kwh = Math.max(0, referenceKwh);

  // Compute tier based on kWh
  let computedTier: number;
  if (kwh > 400) computedTier = 6;
  else if (kwh > 300) computedTier = 5;
  else if (kwh > 200) computedTier = 4;
  else if (kwh > 100) computedTier = 3;
  else if (kwh > 50) computedTier = 2;
  else computedTier = 1;

  const effectiveTier = currentTierNumber && currentTierNumber >= 1 && currentTierNumber <= 6
    ? currentTierNumber
    : computedTier;

  const tiers: TierCostSplitItem[] = [];
  let remaining = kwh;
  let totalCostWithoutVat = 0;

  for (const def of EVN_TIERS) {
    const kwhInThisTier = def.tier === 6
      ? Math.max(0, remaining)
      : Math.min(Math.max(0, remaining), def.capacityKwh);

    remaining = Math.max(0, remaining - kwhInThisTier);

    const costWithoutVat = kwhInThisTier * def.pricePerKwh;
    const costWithVat = costWithoutVat * (1 + VAT_RATE);
    totalCostWithoutVat += costWithoutVat;

    const isCurrent = def.tier === effectiveTier;
    const isFilled = kwhInThisTier > 0 && (def.tier < effectiveTier || (def.tier === 6 && kwh > 400));

    tiers.push({
      tier: def.tier,
      label: def.label,
      rangeLabel: def.rangeLabel,
      pricePerKwh: def.pricePerKwh,
      kwhInTier: kwhInThisTier,
      costVndWithoutVat: costWithoutVat,
      costVndWithVat: costWithVat,
      isFilled,
      isCurrent,
    });
  }

  // Progress in current tier
  let progressInCurrentTier: number;
  let kwhLeftToNextTier: number | null;
  let nextTierPrice: number | null;

  const currentDef = EVN_TIERS[effectiveTier - 1];
  if (effectiveTier === 6) {
    progressInCurrentTier = 100;
    kwhLeftToNextTier = null;
    nextTierPrice = null;
  } else {
    const consumedInTier = Math.max(0, kwh - currentDef.minKwh);
    progressInCurrentTier = Math.min(100, Math.max(0, (consumedInTier / currentDef.capacityKwh) * 100));
    kwhLeftToNextTier = Math.max(0, currentDef.maxKwh - kwh);
    nextTierPrice = EVN_TIERS[effectiveTier].pricePerKwh;
  }

  const totalCostWithVat = totalCostWithoutVat * (1 + VAT_RATE);

  return {
    tiers,
    totalKwh: kwh,
    totalCostWithoutVat,
    totalCostWithVat,
    computedTier: effectiveTier,
    progressInCurrentTier,
    kwhLeftToNextTier,
    nextTierPrice,
  };
}

export interface RoomEnergyAggregation {
  roomName: string;
  kwh: number;
  costVnd: number;
  percentage: number;
  deviceCount: number;
  devices: DeviceEnergyBreakdown[];
}

export function aggregateByRoom(
  breakdown: DeviceEnergyBreakdown[],
  totalKwh: number
): RoomEnergyAggregation[] {
  const map = new Map<string, { kwh: number; costVnd: number; devices: DeviceEnergyBreakdown[] }>();

  for (const item of breakdown) {
    const room = item.roomName?.trim() || 'Chưa phân phòng';
    const entry = map.get(room) || { kwh: 0, costVnd: 0, devices: [] };
    entry.kwh += item.kwh || item.energyKwh || 0;
    entry.costVnd += item.costVnd || item.estimatedCostVnd || 0;
    entry.devices.push(item);
    map.set(room, entry);
  }

  const result: RoomEnergyAggregation[] = [];
  const validTotal = totalKwh > 0 ? totalKwh : Array.from(map.values()).reduce((s, r) => s + r.kwh, 0);

  map.forEach((val, roomName) => {
    const pct = validTotal > 0 ? (val.kwh / validTotal) * 100 : 0;
    result.push({
      roomName,
      kwh: Number(val.kwh.toFixed(2)),
      costVnd: Math.round(val.costVnd),
      percentage: Number(pct.toFixed(1)),
      deviceCount: val.devices.length,
      devices: val.devices,
    });
  });

  return result.sort((a, b) => b.kwh - a.kwh);
}

export interface EnergySavingTip {
  id: string;
  type: 'AC_OPTIMIZATION' | 'SCHEDULE_AUTOMATION' | 'LIGHT_OPTIMIZATION' | 'TIER_REDUCTION';
  title: string;
  description: string;
  estimatedSavingVnd: number;
  actionText?: string;
  actionHref?: string;
  badge: string;
}

export function generateSavingTips(
  summary: EnergySummary | undefined,
  breakdown: DeviceEnergyBreakdown[],
  period: '24H' | '7D' | '30D',
  homeId?: string
): EnergySavingTip[] {
  const tips: EnergySavingTip[] = [];
  if (!breakdown || breakdown.length === 0) return tips;

  const daysInPeriod = period === '24H' ? 1 : period === '7D' ? 7 : 30;
  const sorted = [...breakdown].sort((a, b) => (b.kwh || 0) - (a.kwh || 0));

  // Heuristic 1: AC/Climate optimization (~6% of AC cost)
  const acDevice = sorted.find((d) => {
    const type = (d.deviceType || '').toUpperCase();
    const name = (d.deviceName || '').toUpperCase();
    return (
      type.includes('AIR') ||
      type.includes('CLIMATE') ||
      type.includes('AC') ||
      name.includes('ĐIỀU HÒA') ||
      name.includes('MÁY LẠNH')
    );
  });

  if (acDevice && (acDevice.costVnd || 0) > 5000) {
    const saving = Math.round((acDevice.costVnd || 0) * 0.06);
    tips.push({
      id: `ac-${acDevice.deviceId}`,
      type: 'AC_OPTIMIZATION',
      title: 'Tăng nhiệt độ cài đặt 1–2°C',
      description: `Điều hòa "${acDevice.deviceName}" (${acDevice.roomName || 'phòng'}) đang tiêu thụ ${formatKwh(acDevice.kwh)} kWh. Đặt nhiệt độ ở mức 26–27°C kèm quạt gió giúp tiết kiệm ~6% điện năng.`,
      estimatedSavingVnd: saving,
      badge: 'Điều hòa không khí',
    });
  }

  // Heuristic 2: Excessive on-hours (> 10h/day average)
  const highRuntimeDevice = sorted.find((d) => {
    const onHours = d.totalOnHours || d.runtimeHours || 0;
    const avgDailyHours = onHours / daysInPeriod;
    return avgDailyHours > 10 && (d.costVnd || 0) > 8000;
  });

  if (highRuntimeDevice) {
    const avgDaily = ((highRuntimeDevice.totalOnHours || highRuntimeDevice.runtimeHours || 0) / daysInPeriod).toFixed(1);
    const saving = Math.round((highRuntimeDevice.costVnd || 0) * 0.2);
    tips.push({
      id: `sched-${highRuntimeDevice.deviceId}`,
      type: 'SCHEDULE_AUTOMATION',
      title: 'Đặt lịch tắt tự động thiết bị chạy nền',
      description: `"${highRuntimeDevice.deviceName}" hoạt động trung bình ~${avgDaily}h/ngày. Thiết lập kịch bản tự tắt khi vắng nhà hoặc ban đêm để giảm đến ~20% hao phí.`,
      estimatedSavingVnd: saving,
      actionText: 'Tạo quy tắc tự động',
      actionHref: homeId ? `/homes/${homeId}/automation-rules` : undefined,
      badge: 'Lịch hoạt động',
    });
  }

  // Heuristic 3: Lighting on for prolonged times (~15% of lighting cost)
  const lightDevice = sorted.find((d) => {
    const type = (d.deviceType || '').toUpperCase();
    const name = (d.deviceName || '').toUpperCase();
    const isLight = type.includes('LIGHT') || type.includes('LAMP') || name.includes('ĐÈN');
    const onHours = d.totalOnHours || d.runtimeHours || 0;
    return isLight && onHours > 0 && (d.costVnd || 0) > 3000;
  });

  if (lightDevice) {
    const saving = Math.round((lightDevice.costVnd || 0) * 0.15);
    tips.push({
      id: `light-${lightDevice.deviceId}`,
      type: 'LIGHT_OPTIMIZATION',
      title: 'Giảm độ sáng / dùng cảm biến chuyển động',
      description: `Hệ thống đèn "${lightDevice.deviceName}" tiêu thụ ${formatKwh(lightDevice.kwh)} kWh. Giảm độ sáng xuống 75% hoặc kích hoạt tự tắt theo cảm biến có thể tiết kiệm ~15%.`,
      estimatedSavingVnd: saving,
      badge: 'Chiếu sáng',
    });
  }

  // Heuristic 4: EVN Tier reduction if currentTier >= 4
  const referenceKwh = period === '30D' ? (summary?.totalKwh ?? 0) : (summary?.projectedMonthKwh ?? 0);
  const currentTier = summary?.currentTier ?? 1;

  if (currentTier >= 4 && referenceKwh > 200) {
    const prevTierDef = EVN_TIERS[currentTier - 2]; // Tier before current
    const neededReduction = Math.max(1, referenceKwh - prevTierDef.maxKwh);
    const currentPrice = EVN_TIERS[currentTier - 1].pricePerKwh;
    const lowerPrice = prevTierDef.pricePerKwh;
    const saving = Math.round(neededReduction * (currentPrice - lowerPrice) * (1 + VAT_RATE));

    if (saving > 5000) {
      tips.push({
        id: `tier-reduce-${currentTier}`,
        type: 'TIER_REDUCTION',
        title: `Mục tiêu hạ về Bậc ${currentTier - 1} EVN`,
        description: `Giảm ~${formatKwh(neededReduction)} kWh trong chu kỳ sẽ đưa hóa đơn về Bậc ${currentTier - 1}, tránh biểu giá lũy tiến ${currentPrice.toLocaleString('vi-VN')} đ/kWh.`,
        estimatedSavingVnd: saving,
        badge: 'Tối ưu hóa đơn',
      });
    }
  }

  return tips.slice(0, 4);
}
