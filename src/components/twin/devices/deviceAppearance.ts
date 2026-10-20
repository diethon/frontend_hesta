export type DeviceModelKind = 'ceiling-light' | 'pendant-light' | 'floor-lamp' | 'table-lamp' | 'wall-light' | 'led-strip'
  | 'ceiling-fan' | 'standing-fan' | 'ac' | 'tv' | 'camera' | 'door' | 'window' | 'curtain' | 'plug' | 'remote'
  | 'climate-sensor' | 'motion-sensor' | 'smoke-sensor' | 'generic';
export type DeviceMount = 'ceiling' | 'wall' | 'floor' | 'table' | 'opening';
export interface DeviceAppearance { kind: DeviceModelKind; mount: DeviceMount; label: string; source: 'type' | 'name' | 'fallback' }
type Definition = Omit<DeviceAppearance, 'source'>;
const appearances: Record<DeviceModelKind, Definition> = {
  'ceiling-light': { kind: 'ceiling-light', mount: 'ceiling', label: 'Đèn trần' },
  'pendant-light': { kind: 'pendant-light', mount: 'ceiling', label: 'Đèn thả' },
  'floor-lamp': { kind: 'floor-lamp', mount: 'floor', label: 'Đèn cây' },
  'table-lamp': { kind: 'table-lamp', mount: 'table', label: 'Đèn bàn' },
  'wall-light': { kind: 'wall-light', mount: 'wall', label: 'Đèn tường' },
  'led-strip': { kind: 'led-strip', mount: 'wall', label: 'Dải LED' },
  'ceiling-fan': { kind: 'ceiling-fan', mount: 'ceiling', label: 'Quạt trần' },
  'standing-fan': { kind: 'standing-fan', mount: 'floor', label: 'Quạt đứng' },
  ac: { kind: 'ac', mount: 'wall', label: 'Điều hòa treo tường' },
  tv: { kind: 'tv', mount: 'wall', label: 'TV' },
  camera: { kind: 'camera', mount: 'wall', label: 'Camera' },
  door: { kind: 'door', mount: 'opening', label: 'Cửa' },
  window: { kind: 'window', mount: 'opening', label: 'Cửa sổ' },
  curtain: { kind: 'curtain', mount: 'opening', label: 'Rèm' },
  plug: { kind: 'plug', mount: 'wall', label: 'Ổ cắm thông minh' },
  remote: { kind: 'remote', mount: 'table', label: 'Bộ phát hồng ngoại' },
  'climate-sensor': { kind: 'climate-sensor', mount: 'wall', label: 'Cảm biến nhiệt độ / độ ẩm' },
  'motion-sensor': { kind: 'motion-sensor', mount: 'wall', label: 'Cảm biến chuyển động' },
  'smoke-sensor': { kind: 'smoke-sensor', mount: 'ceiling', label: 'Cảm biến khói' },
  generic: { kind: 'generic', mount: 'floor', label: 'Thiết bị' },
};
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
const lightVariant = (name: string, fallback: DeviceModelKind): DeviceModelKind => {
  if (/\b(day led|dai led|led strip|light strip|den hat|backlight)\b/.test(name)) return 'led-strip';
  if (/\b(den cay|den dung|floor lamp|standing lamp)\b/.test(name)) return 'floor-lamp';
  if (/\b(den ban|den ngu|den dau giuong|table lamp|desk lamp|bedside lamp|night light)\b/.test(name)) return 'table-lamp';
  if (/\b(den tuong|wall light|wall lamp|sconce)\b/.test(name)) return 'wall-light';
  if (/\b(den tha|den chum|pendant|chandelier)\b/.test(name)) return 'pendant-light';
  if (/\b(den tran|am tran|ceiling|downlight|spotlight)\b/.test(name)) return 'ceiling-light';
  return fallback;
};
const fanVariant = (name: string): DeviceModelKind => /\b(quat dung|quat cay|quat ban|standing fan|pedestal fan|floor fan|desk fan)\b/.test(name) ? 'standing-fan' : 'ceiling-fan';
const knownTypes: Record<string, DeviceModelKind> = {
  AC: 'ac', AIR_CONDITIONER: 'ac', TV: 'tv', CAMERA: 'camera', CAMERA_AI: 'camera', DOOR: 'door', GATE: 'door', ROLLING_DOOR: 'door', LOCK: 'door',
  WINDOW: 'window', CURTAIN: 'curtain', BLIND: 'curtain', TEMP_HUMID_SENSOR: 'climate-sensor', SENSOR: 'climate-sensor',
  MOTION_SENSOR: 'motion-sensor', SMOKE_SENSOR: 'smoke-sensor',
};
function fromName(name: string): DeviceModelKind | null {
  if (/\b(cam bien|sensor)\b/.test(name)) {
    if (/\b(khoi|smoke|gas)\b/.test(name)) return 'smoke-sensor';
    if (/\b(chuyen dong|motion|pir)\b/.test(name)) return 'motion-sensor';
    return 'climate-sensor';
  }
  if (/\b(camera|cam an ninh|webcam)\b/.test(name)) return 'camera';
  if (/\b(den|lamp|light|led|chandelier|pendant)\b/.test(name)) return lightVariant(name, 'ceiling-light');
  if (/\b(quat|fan)\b/.test(name)) return fanVariant(name);
  if (/\b(dieu hoa|may lanh|air conditioner|aircon|ac)\b/.test(name)) return 'ac';
  if (/\b(tivi|ti vi|tv|television)\b/.test(name)) return 'tv';
  if (/\b(rem|curtain|blind)\b/.test(name)) return 'curtain';
  if (/\b(cua so|window)\b/.test(name)) return 'window';
  if (/\b(cua|cong|door|gate)\b/.test(name)) return 'door';
  return null;
}

/** Visual inference only. Never use this result to infer commands or permissions. */
export function resolveDeviceAppearance(type: string, name = ''): DeviceAppearance {
  const normalizedType = type.trim().toUpperCase();
  const normalizedName = normalize(name);
  if (normalizedType === 'LIGHT' || normalizedType === 'LED_RGB') return { ...appearances[lightVariant(normalizedName, normalizedType === 'LED_RGB' ? 'led-strip' : 'ceiling-light')], source: 'type' };
  if (normalizedType === 'FAN') return { ...appearances[fanVariant(normalizedName)], source: 'type' };
  if (knownTypes[normalizedType]) return { ...appearances[knownTypes[normalizedType]], source: 'type' };
  // IR bridges and smart plugs may be named after their connected appliance.
  const inferred = fromName(normalizedName);
  if (inferred) return { ...appearances[inferred], source: 'name' };
  const fallback = normalizedType === 'SMART_PLUG' || normalizedType === 'SOCKET' ? 'plug' : normalizedType === 'IR_REMOTE' ? 'remote' : 'generic';
  return { ...appearances[fallback], source: fallback === 'generic' ? 'fallback' : 'type' };
}
