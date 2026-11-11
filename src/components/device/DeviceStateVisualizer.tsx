import React, { useState } from 'react';
import { Sparkles, Code2, Check, Copy, Power, Sliders, Palette, Thermometer, Activity, Eye, Zap } from 'lucide-react';

interface DeviceStateVisualizerProps {
  state: Record<string, unknown> | null | undefined;
  compact?: boolean;
  showJsonToggle?: boolean;
  defaultShowJson?: boolean;
  emptyText?: string;
  deviceType?: string;
}

// Bảng trọng số sắp xếp thứ tự logic cho các trường
const KEY_ORDER_MAP: Record<string, number> = {
  power: 10,
  status: 11,
  online: 12,
  state: 13,
  relay1: 20,
  relay2: 21,
  relay3: 22,
  relay4: 23,
  brightness: 30,
  dimmer: 31,
  speed: 32,
  fan_speed: 33,
  // RGB Luôn liền kề: R -> G -> B (Trọng số 40, 41, 42)
  r: 40,
  g: 41,
  b: 42,
  red: 43,
  green: 44,
  blue: 45,
  color: 46,
  color_temp: 47,
  hex: 48,
  hue: 49,
  saturation: 50,
  // Khí hậu & Điều hòa
  temperature: 60,
  target_temperature: 61,
  current_temperature: 62,
  humidity: 63,
  mode: 64,
  fan: 65,
  swing: 66,
  // Cảm biến
  motion: 70,
  smoke: 71,
  gas: 72,
  door: 73,
  contact: 74,
  lux: 75,
  illuminance: 76,
  // Điện năng
  voltage: 80,
  current: 81,
  power_w: 82,
  energy_kwh: 83,
};

const LIGHT_EXCLUDED_KEYS = new Set([
  'temperature', 'target_temperature', 'current_temperature', 'humidity',
  'mode', 'fan', 'swing', 'state', 'level'
]);

const AC_EXCLUDED_KEYS = new Set([
  'r', 'g', 'b', 'color', 'hex', 'hue', 'saturation', 'dimmer'
]);

const SENSOR_EXCLUDED_KEYS = new Set([
  'mode', 'fan', 'swing', 'r', 'g', 'b', 'color', 'hex', 'dimmer', 'state'
]);

export function isFieldAllowedForDeviceType(key: string, deviceType?: string): boolean {
  if (!deviceType) return true;
  const dt = deviceType.toUpperCase();
  const lk = key.toLowerCase();
  
  if (dt === 'LIGHT' || dt === 'LED' || dt === 'LED_RGB' || dt === 'SMART_PLUG') {
    if (LIGHT_EXCLUDED_KEYS.has(lk)) return false;
  } else if (dt === 'AC' || dt === 'AIR_CONDITIONER') {
    if (AC_EXCLUDED_KEYS.has(lk)) return false;
  } else if (dt.includes('SENSOR')) {
    if (SENSOR_EXCLUDED_KEYS.has(lk)) return false;
  }
  return true;
}

// Sắp xếp các cặp [key, value] theo trật tự logic: Nguồn -> Độ sáng -> R -> G -> B -> Điều hòa -> Cảm biến
export function sortStateEntries(
  state: Record<string, unknown> | null | undefined,
  deviceType?: string
): [string, unknown][] {
  if (!state || typeof state !== 'object') return [];
  return Object.entries(state)
    .filter(([key]) => isFieldAllowedForDeviceType(key, deviceType)).sort(([keyA], [keyB]) => {
    const orderA = KEY_ORDER_MAP[keyA.toLowerCase()] ?? (100 + keyA.localeCompare(keyB));
    const orderB = KEY_ORDER_MAP[keyB.toLowerCase()] ?? (100 + keyB.localeCompare(keyA));
    return orderA - orderB;
  });
}

// Chuyển đổi object sang JSON đã sắp xếp trật tự (r, g, b liền kề nhau) và dịch true/false sang tiếng Việt
export function getSortedFormattedJson(
  state: Record<string, unknown> | null | undefined,
  friendlyBooleans = true,
  deviceType?: string
): string {
  if (!state || typeof state !== 'object') return '{}';
  const sorted = sortStateEntries(state, deviceType);
  const outObj: Record<string, unknown> = {};

  for (const [k, v] of sorted) {
    const isBool = typeof v === 'boolean' || v === 'true' || v === 'false';
    const isTrue = v === true || v === 'true';

    if (friendlyBooleans && isBool) {
      const lk = k.toLowerCase();
      if (lk === 'power' || lk.startsWith('relay')) {
        outObj[k] = isTrue ? 'BẬT' : 'TẮT';
      } else if (lk === 'motion') {
        outObj[k] = isTrue ? 'Phát hiện chuyển động' : 'Bình thường';
      } else if (lk === 'smoke' || lk === 'gas') {
        outObj[k] = isTrue ? 'CẢNH BÁO NGUY HIỂM' : 'An toàn';
      } else if (lk === 'door' || lk === 'contact') {
        outObj[k] = isTrue ? 'Đang MỞ' : 'Đang ĐÓNG';
      } else if (lk === 'online') {
        outObj[k] = isTrue ? 'Trực tuyến' : 'Ngoại tuyến';
      } else {
        outObj[k] = isTrue ? 'BẬT' : 'TẮT';
      }
    } else {
      outObj[k] = v;
    }
  }

  return JSON.stringify(outObj, null, 2);
}


// Chuyển đổi mã loại thiết bị sang tên tiếng Việt thân thiện
export function getFriendlyDeviceTypeName(type: string | undefined | null): string {
  if (!type) return 'Thiết bị thông minh';
  switch (type.toUpperCase()) {
    case 'LIGHT': return 'Đèn chiếu sáng';
    case 'LED':
    case 'LED_RGB': return 'Đèn màu thông minh (RGB)';
    case 'FAN': return 'Quạt điện';
    case 'AC':
    case 'AIR_CONDITIONER': return 'Máy điều hòa nhiệt độ';
    case 'SMART_PLUG':
    case 'SOCKET': return 'Ổ cắm thông minh';
    case 'SWITCH': return 'Công tắc thông minh';
    case 'WATER_PUMP': return 'Máy bơm nước';
    case 'GATE': return 'Cổng tự động';
    case 'DOOR': return 'Cửa ra vào';
    case 'LOCK': return 'Khóa thông minh';
    case 'TEMP_HUMID_SENSOR': return 'Cảm biến nhiệt độ & độ ẩm';
    case 'MOTION_SENSOR': return 'Cảm biến chuyển động';
    case 'SMOKE_SENSOR': return 'Cảm biến khói';
    case 'LIGHT_SENSOR':
    case 'LUX_SENSOR': return 'Cảm biến ánh sáng';
    case 'CAMERA':
    case 'CAMERA_AI': return 'Camera an ninh';
    case 'IR_REMOTE': return 'Điều khiển hồng ngoại';
    default: return type;
  }
}

export const DeviceStateVisualizer: React.FC<DeviceStateVisualizerProps> = ({
  state,
  compact = false,
  showJsonToggle = true,
  defaultShowJson = false,
  emptyText = 'Chưa có thông tin trạng thái',
  deviceType,
}) => {
  const [showJson, setShowJson] = useState(defaultShowJson);
  const [copied, setCopied] = useState(false);

  if (!state || Object.keys(state).length === 0) {
    return <span className="text-xs text-muted italic">{emptyText}</span>;
  }

  const sortedEntries = sortStateEntries(state, deviceType);

  // Kiểm tra xem có đồng thời cả 3 kênh R, G, B không để gom nhóm thành 1 thẻ màu thống nhất
  const hasR = state.r !== undefined;
  const hasG = state.g !== undefined;
  const hasB = state.b !== undefined;
  const hasRgbGroup = hasR && hasG && hasB;

  const rNum = Number(state.r ?? 0);
  const gNum = Number(state.g ?? 0);
  const bNum = Number(state.b ?? 0);
  const rgbString = `rgb(${rNum}, ${gNum}, ${bNum})`;

  const handleCopy = () => {
    const jsonStr = getSortedFormattedJson(state, true, deviceType);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Render từng thuộc tính thân thiện
  const renderItem = (key: string, value: unknown) => {
    const lk = key.toLowerCase();
    const strVal = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);

    // 1. Nguồn / Công tắc (power, relay)
    if (lk === 'power' || lk.startsWith('relay')) {
      const isOn = strVal.toUpperCase() === 'ON' || strVal === 'true' || value === true;
      const relayNum = lk.replace('relay', '');
      return (
        <div key={key} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-surface border border-line">
          <span className="text-muted text-xs flex items-center gap-1.5 font-medium">
            <Power className="w-3.5 h-3.5 text-primary" />
            {relayNum ? `Công tắc ${relayNum}` : 'Nguồn chính'}
          </span>
          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
            isOn
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              : 'bg-muted/10 text-muted border-line'
          }`}>
            {isOn ? 'BẬT' : 'TẮT'}
          </span>
        </div>
      );
    }

    // 2. Độ sáng (brightness / dimmer)
    if (lk === 'brightness' || lk === 'dimmer') {
      return (
        <div key={key} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-surface border border-line">
          <span className="text-muted text-xs flex items-center gap-1.5 font-medium">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            Độ sáng
          </span>
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 font-mono">
            {strVal}%
          </span>
        </div>
      );
    }

    // 3. Nhiệt độ
    if (lk === 'temperature' || lk === 'target_temperature') {
      return (
        <div key={key} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-surface border border-line">
          <span className="text-muted text-xs flex items-center gap-1.5 font-medium">
            <Thermometer className="w-3.5 h-3.5 text-blue-400" />
            Nhiệt độ cài đặt
          </span>
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 font-mono">
            {strVal}°C
          </span>
        </div>
      );
    }

    // 4. Các kênh màu riêng rẽ nếu không đủ bộ RGB 3 kênh
    if (lk === 'r' || lk === 'red') {
      return (
        <div key={key} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-surface border border-line">
          <span className="text-muted text-xs flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
            Màu Đỏ (R)
          </span>
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-500/10 text-red-500 border border-red-500/20 font-mono">
            {strVal}
          </span>
        </div>
      );
    }
    if (lk === 'g' || lk === 'green') {
      return (
        <div key={key} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-surface border border-line">
          <span className="text-muted text-xs flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            Màu Lục (G)
          </span>
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-mono">
            {strVal}
          </span>
        </div>
      );
    }
    if (lk === 'b' || lk === 'blue') {
      return (
        <div key={key} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-surface border border-line">
          <span className="text-muted text-xs flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
            Màu Lam (B)
          </span>
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 font-mono">
            {strVal}
          </span>
        </div>
      );
    }

    // 5. Điện áp, Công suất
    if (lk === 'voltage') {
      return (
        <div key={key} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-surface border border-line">
          <span className="text-muted text-xs flex items-center gap-1.5 font-medium">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Điện áp
          </span>
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 font-mono">
            {strVal}V
          </span>
        </div>
      );
    }
    if (lk === 'power_w' || lk === 'watts') {
      return (
        <div key={key} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-surface border border-line">
          <span className="text-muted text-xs flex items-center gap-1.5 font-medium">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            Công suất tức thời
          </span>
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 font-mono">
            {strVal}W
          </span>
        </div>
      );
    }

    // 6. Các trường boolean khác (chống hiển thị true/false gây khó hiểu)
    if (typeof value === 'boolean' || strVal === 'true' || strVal === 'false') {
      const isTrue = value === true || strVal === 'true';
      let label = key;
      let trueText = 'BẬT';
      let falseText = 'TẮT';

      if (lk === 'motion') {
        label = 'Cảm biến chuyển động';
        trueText = 'Có chuyển động';
        falseText = 'Yên tĩnh';
      } else if (lk === 'smoke') {
        label = 'Cảm biến khói';
        trueText = 'PHÁT HIỆN KHÓI';
        falseText = 'An toàn';
      } else if (lk === 'gas') {
        label = 'Cảm biến gas';
        trueText = 'RÒ RỈ GAS';
        falseText = 'Bình thường';
      } else if (lk === 'door' || lk === 'contact') {
        label = 'Cửa ra vào';
        trueText = 'Đang MỞ';
        falseText = 'Đang ĐÓNG';
      } else if (lk === 'online') {
        label = 'Trạng thái mạng';
        trueText = 'Trực tuyến';
        falseText = 'Ngoại tuyến';
      }

      return (
        <div key={key} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-surface border border-line">
          <span className="text-muted text-xs flex items-center gap-1.5 font-medium capitalize">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            {label}
          </span>
          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
            isTrue
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              : 'bg-muted/10 text-muted border-line'
          }`}>
            {isTrue ? trueText : falseText}
          </span>
        </div>
      );
    }

    // 7. Mặc định các trường khác
    return (
      <div key={key} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-surface border border-line">
        <span className="text-muted text-xs font-medium capitalize">{key}</span>
        <span className="text-text text-xs font-semibold font-mono bg-sidebar px-2 py-0.5 rounded border border-line">
          {strVal}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {/* Header controls: Switch giữa xem thân thiện & xem JSON */}
      {showJsonToggle && !compact && (
        <div className="flex items-center justify-between pb-1">
          <span className="text-xs text-muted font-medium flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            {showJson ? 'Mã JSON (Đã phân loại R-G-B liền kề & dịch Bật/Tắt)' : 'Thông số trực quan'}
          </span>
          <div className="flex items-center gap-2">
            {showJson && (
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] text-muted hover:text-text cursor-pointer transition-colors"
                title="Sao chép JSON"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500 font-medium">Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowJson(!showJson)}
              className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
            >
              {showJson ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Xem dạng thẻ trực quan</span>
                </>
              ) : (
                <>
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Xem mã JSON</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {showJson ? (
        <pre className="text-xs text-emerald-400 font-mono bg-slate-950 p-3 rounded-xl overflow-x-auto border border-slate-800 leading-relaxed shadow-inner">
          {getSortedFormattedJson(state, true, deviceType)}
        </pre>
      ) : (
        <div className={`space-y-1.5 ${compact ? 'text-xs' : ''}`}>
          {/* Nhóm màu RGB gom lại liền nhau nếu có đủ cả 3 kênh r, g, b */}
          {hasRgbGroup && (
            <div className="p-2.5 rounded-xl bg-surface border border-line flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-6 h-6 rounded-full border-2 border-white/40 shadow-xs shrink-0"
                  style={{ backgroundColor: rgbString }}
                />
                <div>
                  <span className="text-xs font-bold text-text flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5 text-primary" />
                    Màu sắc RGB
                  </span>
                  <p className="text-[10px] text-muted font-mono mt-0.5">
                    Đỏ (R): {rNum} · Lục (G): {gNum} · Lam (B): {bNum}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-sidebar border border-line text-text">
                {rgbString}
              </span>
            </div>
          )}

          {/* Các trường còn lại (đã loại r, g, b nếu đã gom vào thẻ trên) */}
          {sortedEntries
            .filter(([k, v]) => {
              const lk = k.toLowerCase();
              if (hasRgbGroup && (lk === 'r' || lk === 'g' || lk === 'b' || lk === 'color' || lk === 'hex')) { return false; } if (typeof v === 'object' && v !== null) { return false; } if (lk.startsWith('timer') && (v === false || v === 'false' || v === 0 || v === '0')) { return false; }
              return true;
            })
            .map(([k, v]) => renderItem(k, v))}
        </div>
      )}
    </div>
  );
};
