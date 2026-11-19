// Starting points offered when creating a scene. Each template picks matching devices from the home.
import type { DeviceSummary } from '../../types/automation';
import type { IconName } from '../ui/LucideIcon';
import type { DraftSceneAction } from './sceneActions';
import { isDeviceControllable } from './DevicePickerSheet';

export type SceneTemplateKey = 'morning' | 'night' | 'away' | 'home' | 'blank';

export interface SceneTemplateDraft {
  name: string;
  icon: IconName;
  description: string;
  actions: DraftSceneAction[];
}

const typeOf = (device: DeviceSummary) => (device.deviceType || '').toUpperCase();
const isLight = (d: DeviceSummary) => typeOf(d).includes('LIGHT') || typeOf(d).includes('LED');
const isAc = (d: DeviceSummary) => typeOf(d).includes('AC') || typeOf(d).includes('AIR');
const isGate = (d: DeviceSummary) => typeOf(d).includes('GATE') || typeOf(d).includes('DOOR');

const step = (device: DeviceSummary | undefined, action: string): DraftSceneAction[] =>
  device ? [{ deviceId: device.id, action, value: '' }] : [];

export function buildSceneTemplate(key: SceneTemplateKey, devices: DeviceSummary[]): SceneTemplateDraft {
  const controllable = devices.filter(isDeviceControllable);
  const light = controllable.find(isLight);
  const ac = controllable.find(isAc);
  const gate = controllable.find(isGate);
  // When the home has none of the template's devices, fall back to the first controllable one.
  const orFirst = (actions: DraftSceneAction[], fallbackAction: string) =>
    actions.length > 0 ? actions : step(controllable[0], fallbackAction);

  switch (key) {
    case 'morning':
      return {
        name: 'Chào buổi sáng',
        icon: 'sun',
        description: 'Bật đèn, mở cổng đón ngày mới',
        actions: orFirst([...step(light, 'TURN_ON'), ...step(gate, 'OPEN')], 'TURN_ON'),
      };
    case 'night':
      return {
        name: 'Chúc ngủ ngon',
        icon: 'moon',
        description: 'Tắt đèn, khóa cửa và tiết kiệm điện',
        actions: orFirst([...step(light, 'TURN_OFF'), ...step(gate, 'CLOSE')], 'TURN_OFF'),
      };
    case 'away':
      return {
        name: 'Rời khỏi nhà',
        icon: 'door',
        description: 'Tắt toàn bộ thiết bị khi ra ngoài',
        actions: controllable.slice(0, 3).flatMap((d) => step(d, 'TURN_OFF')),
      };
    case 'home':
      return {
        name: 'Về đến nhà',
        icon: 'home',
        description: 'Bật đèn và khởi động điều hòa',
        actions: orFirst([...step(light, 'TURN_ON'), ...step(ac, 'TURN_ON')], 'TURN_ON'),
      };
    default:
      return { name: 'Kịch bản mới', icon: 'sparkles', description: '', actions: [] };
  }
}
