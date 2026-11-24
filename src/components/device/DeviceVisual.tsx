import React from 'react';

export type DeviceVisualKind =
  | 'light'
  | 'led-rgb'
  | 'ac'
  | 'tv'
  | 'fan'
  | 'pump'
  | 'camera'
  | 'gate'
  | 'rolling-door'
  | 'door'
  | 'curtain'
  | 'lock'
  | 'plug'
  | 'switch'
  | 'ir-remote'
  | 'sensor-temp'
  | 'sensor-lux'
  | 'sensor-smoke'
  | 'sensor-flame'
  | 'sensor-gas'
  | 'sensor-motion';

export const DEVICE_VISUAL_IMAGE_MAP: Record<DeviceVisualKind, string> = {
  light: '/images/devices/light.png',
  'led-rgb': '/images/devices/led-rgb.png',
  ac: '/images/devices/ac.png',
  tv: '/images/devices/tv.png',
  fan: '/images/devices/fan.png',
  pump: '/images/devices/pump.png',
  camera: '/images/devices/camera.png',
  gate: '/images/devices/gate.png',
  'rolling-door': '/images/devices/rolling-door.png',
  door: '/images/devices/door.png',
  curtain: '/images/devices/curtain.png',
  lock: '/images/devices/lock.png',
  plug: '/images/devices/plug.png',
  switch: '/images/devices/switch.png',
  'ir-remote': '/images/devices/ir-remote.png',
  'sensor-temp': '/images/devices/sensor-temp.png',
  'sensor-lux': '/images/devices/sensor-lux.png',
  'sensor-smoke': '/images/devices/sensor-smoke.png',
  'sensor-flame': '/images/devices/sensor-flame.png',
  'sensor-gas': '/images/devices/sensor-gas.png',
  'sensor-motion': '/images/devices/sensor-motion.png',
};

export interface DeviceVisualProps {
  uid?: string;
  deviceType?: string | null;
  figmaType?: string | null;
  name?: string | null;
  icon?: string | null;
  isOn?: boolean;
  offline?: boolean;
  brightness?: number;
  rgbColor?: string | null;
  acMode?: string | null;
  gateState?: string | null;
  sensorState?: Record<string, unknown> | null;
  size?: number;
  className?: string;
}

export function resolveDeviceVisualKind(props: {
  deviceType?: string | null;
  figmaType?: string | null;
  name?: string | null;
  icon?: string | null;
}): DeviceVisualKind {
  const rawType = (props.deviceType || '').trim().toUpperCase();
  const figma = (props.figmaType || '').trim();
  const nameLower = (props.name || '').trim().toLowerCase();
  const icon = (props.icon || '').trim().toLowerCase();

  // Stage 1: Exact enum deviceType match ALWAYS takes priority over name heuristics
  if (rawType === 'LED_RGB') return 'led-rgb';
  if (rawType === 'LIGHT' || rawType === 'LED') return 'light';
  if (rawType === 'AIR_CONDITIONER' || rawType === 'AC' || rawType === 'AC_REMOTE') return 'ac';
  if (rawType === 'ROLLING_DOOR') return 'rolling-door';
  if (rawType === 'CURTAIN') return 'curtain';
  if (rawType === 'DOOR') return 'door';
  if (rawType === 'GATE' || rawType === 'GATE_MOTOR') return 'gate';
  if (rawType === 'IR_REMOTE') return 'ir-remote';
  if (rawType === 'FLAME_SENSOR' || rawType === 'FIRE_SENSOR') return 'sensor-flame';
  if (rawType === 'GAS_SENSOR') return 'sensor-gas';
  if (rawType === 'SMOKE_SENSOR') return 'sensor-smoke';
  if (rawType === 'TEMP_HUMID_SENSOR') return 'sensor-temp';
  if (rawType === 'LUX_SENSOR' || rawType === 'LIGHT_SENSOR') return 'sensor-lux';
  if (rawType === 'MOTION_SENSOR') return 'sensor-motion';
  if (rawType === 'TV') return 'tv';
  if (rawType === 'FAN') return 'fan';
  if (rawType === 'WATER_PUMP') return 'pump';
  if (rawType === 'CAMERA_AI' || rawType === 'CAMERA') return 'camera';
  if (rawType === 'SMART_PLUG' || rawType === 'SOCKET') return 'plug';
  if (rawType === 'LOCK') return 'lock';
  if (rawType === 'SWITCH') return 'switch';

  // Stage 2: Heuristic fallback when deviceType is absent or generic
  if (figma === 'Điều hòa') return 'ac';
  if (figma === 'Camera') return 'camera';
  if (figma === 'Đèn' || icon === 'lamp') return 'light';
  if (nameLower.includes('cửa cuốn')) return 'rolling-door';
  if (nameLower.includes('rèm')) return 'curtain';
  if (nameLower.includes('hồng ngoại')) return 'ir-remote';
  if (icon === 'flame' || nameLower.includes('báo cháy') || nameLower.includes('lửa')) return 'sensor-flame';
  if (nameLower.includes('khí gas') || nameLower.includes('rò gas')) return 'sensor-gas';
  if (icon === 'shield' || nameLower.includes('khói')) return 'sensor-smoke';
  if (icon === 'thermometer') return 'sensor-temp';
  if (icon === 'sun') return 'sensor-lux';
  if (icon === 'activity' || nameLower.includes('chuyển động')) return 'sensor-motion';
  if (nameLower.includes('tivi') || nameLower.includes('smart tv')) return 'tv';
  if (nameLower.includes('quạt')) return 'fan';
  if (icon === 'droplet' || nameLower.includes('bơm')) return 'pump';
  if (icon === 'lock' || nameLower.includes('khóa')) return 'lock';
  if (nameLower.includes('ổ cắm')) return 'plug';
  if (nameLower.includes('cửa chính') || nameLower.includes('cửa ra vào')) return 'door';
  if (figma === 'Cổng') return 'gate';
  return 'switch';
}

function clampBrightness(brightness?: number): number {
  const n = typeof brightness === 'number' && !Number.isNaN(brightness) ? brightness : 80;
  return Math.max(10, Math.min(100, n));
}

function resolveAcAccent(acMode?: string | null): { main: string; soft: string } {
  const m = (acMode || '').trim().toUpperCase();
  if (m === 'HEAT' || m === 'SƯỞI') return { main: '#fb923c', soft: '#fed7aa' };
  if (m === 'DRY' || m === 'HÚT ẨM') return { main: '#2dd4bf', soft: '#99f6e4' };
  if (m === 'AUTO' || m === 'TỰ ĐỘNG') return { main: '#818cf8', soft: '#c7d2fe' };
  return { main: '#38bdf8', soft: '#bae6fd' };
}

const CONTROLLABLE_KINDS = new Set<DeviceVisualKind>([
  'light',
  'led-rgb',
  'ac',
  'tv',
  'fan',
  'pump',
  'plug',
  'switch',
]);

export const DeviceVisual: React.FC<DeviceVisualProps> = ({
  deviceType,
  figmaType,
  name,
  icon,
  isOn = false,
  offline = false,
  brightness = 80,
  rgbColor,
  acMode,
  sensorState,
  size = 64,
  className = '',
}) => {
  const kind = resolveDeviceVisualKind({ deviceType, figmaType, name, icon });
  const active = Boolean(isOn) && !offline;
  const bRatio = clampBrightness(brightness) / 100;
  const activeRgb = kind === 'led-rgb' ? (rgbColor || '#a855f7') : undefined;
  const acAccent = kind === 'ac' ? resolveAcAccent(acMode) : undefined;
  const imageSrc = DEVICE_VISUAL_IMAGE_MAP[kind];

  const isControllable = CONTROLLABLE_KINDS.has(kind);
  const smokeVal = sensorState?.smoke ?? sensorState?.gas_ppm ?? sensorState?.gas;
  const hasFlame = Boolean(sensorState?.flame || sensorState?.FLAME_SENSOR);
  const hasMotion = Boolean(sensorState?.motion ?? sensorState?.MOTION_SENSOR);
  const sensorAlert =
    !offline &&
    ((kind === 'sensor-smoke' && (smokeVal === true || Number(smokeVal) > 50)) ||
      (kind === 'sensor-gas' && (smokeVal === true || Number(smokeVal) > 200)) ||
      (kind === 'sensor-flame' && hasFlame) ||
      (kind === 'sensor-motion' && hasMotion));

  let imgFilter: string | undefined;
  if (offline) {
    imgFilter = 'grayscale(0.42) contrast(1.04) brightness(0.96)';
  } else if (!active && isControllable) {
    imgFilter = 'brightness(0.75) saturate(0.45) contrast(0.98)';
  } else if (kind === 'light' && active) {
    imgFilter = `brightness(${(1.0 + 0.12 * bRatio).toFixed(2)}) saturate(${(1.05 + 0.1 * bRatio).toFixed(2)})`;
  } else if (kind === 'led-rgb' && active) {
    imgFilter = `brightness(${(1.0 + 0.08 * bRatio).toFixed(2)}) saturate(1.1)`;
  } else if (active && isControllable) {
    imgFilter = 'brightness(1.02) saturate(1.1)';
  }

  return (
    <span
      aria-hidden="true"
      className={className}
      data-visual-kind={kind}
      data-visual-state={offline ? 'offline' : active ? 'on' : 'off'}
      data-visual-color={kind === 'led-rgb' && active ? activeRgb : undefined}
      style={{
        width: size,
        height: size,
        borderRadius: 'inherit',
        overflow: 'hidden',
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        opacity: offline ? 0.9 : 1,
        transition: 'opacity 0.25s ease, box-shadow 0.25s ease',
        boxShadow: sensorAlert
          ? 'inset 0 0 0 2px rgba(244, 63, 94, 0.8), 0 0 12px rgba(244, 63, 94, 0.35)'
          : kind === 'light' && active
            ? `0 0 ${Math.round(8 + 10 * bRatio)}px rgba(245, 158, 11, ${(0.25 + 0.3 * bRatio).toFixed(2)})`
            : kind === 'led-rgb' && active && activeRgb
              ? `0 0 ${Math.round(8 + 10 * bRatio)}px ${activeRgb}`
              : undefined,
      }}
    >
      <img
        src={imageSrc}
        alt=""
        width={size}
        height={size}
        draggable={false}
        loading="lazy"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          userSelect: 'none',
          filter: imgFilter,
          transition: 'filter 0.25s ease, transform 0.25s ease',
        }}
      />

      {!offline && !active && isControllable && (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.14)',
            pointerEvents: 'none',
          }}
        />
      )}

      {kind === 'light' && active && (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 50% 38%, rgba(254, 240, 138, 0.52) 0%, rgba(245, 158, 11, 0.22) 48%, transparent 78%)',
            mixBlendMode: 'soft-light',
            opacity: 0.55 + 0.45 * bRatio,
            pointerEvents: 'none',
          }}
        />
      )}

      {kind === 'led-rgb' && active && activeRgb && (
        <>
          <span
            style={{
              position: 'absolute',
              top: '17.4%',
              left: '32%',
              width: '36%',
              height: '54.8%',
              borderRadius: '46% 46% 12% 12% / 24% 24% 6% 6%',
              background: activeRgb,
              mixBlendMode: 'multiply',
              filter: 'blur(2.5px)',
              opacity: 0.78 + 0.2 * bRatio,
              pointerEvents: 'none',
            }}
          />
          <span
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse 42% 40% at 50% 44%, ${activeRgb} 0%, transparent 72%)`,
              mixBlendMode: 'screen',
              opacity: 0.26 + 0.26 * bRatio,
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      {kind === 'ac' && active && acAccent && (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at 50% 78%, ${acAccent.main}55 0%, transparent 68%)`,
            mixBlendMode: 'multiply',
            pointerEvents: 'none',
          }}
        />
      )}
    </span>
  );
};
