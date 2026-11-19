export type DemoLightId = 'ceiling' | 'floor' | 'tv' | 'bedroom' | 'kitchen';
export type DemoLightColor = 'warm' | 'cool' | 'mint' | 'rose';
export type DemoSceneId = 'bright' | 'relax' | 'movie' | 'sleep';
export interface DemoLight { on: boolean; brightness: number; color: DemoLightColor }
export interface DemoAC { on: boolean; temperature: number; mode: 'cool' | 'dry' | 'fan'; fan: 'auto' | 'low' | 'high' }
export interface TwinDemoState { lights: Record<DemoLightId, DemoLight>; ac: DemoAC }

export const demoLights: { id: DemoLightId; name: string; room: string; kind: 'ceiling' | 'floor' | 'tv' }[] = [
  { id: 'ceiling', name: 'Đèn thả phòng khách', room: 'Phòng khách', kind: 'ceiling' },
  { id: 'floor', name: 'Đèn cây cạnh sofa', room: 'Phòng khách', kind: 'floor' },
  { id: 'tv', name: 'Đèn hắt TV', room: 'Phòng khách', kind: 'tv' },
  { id: 'bedroom', name: 'Đèn đầu giường', room: 'Phòng ngủ', kind: 'floor' },
  { id: 'kitchen', name: 'Đèn bàn ăn', room: 'Bếp & bàn ăn', kind: 'ceiling' },
];
export const demoScenes: { id: DemoSceneId; name: string; description: string }[] = [
  { id: 'bright', name: 'Rực sáng', description: 'Tất cả đèn 100%' },
  { id: 'relax', name: 'Thư giãn', description: 'Ánh sáng vàng dịu' },
  { id: 'movie', name: 'Xem phim', description: 'Đèn hắt, ánh sáng thấp' },
  { id: 'sleep', name: 'Đi ngủ', description: 'Chỉ giữ đèn ngủ dịu' },
];
const levels: Record<DemoSceneId, number[]> = {
  bright: [100, 100, 100, 100, 100], relax: [45, 75, 55, 35, 35], movie: [8, 20, 90, 0, 0], sleep: [0, 0, 0, 15, 0],
};
export function createDemoState(): TwinDemoState {
  return applyDemoScene({ lights: {} as Record<DemoLightId, DemoLight>, ac: { on: true, temperature: 24, mode: 'cool', fan: 'auto' } }, 'relax');
}
export function applyDemoScene(state: TwinDemoState, scene: DemoSceneId): TwinDemoState {
  return { ...state, lights: Object.fromEntries(demoLights.map(({ id }, index) => [id, { on: levels[scene][index] > 0, brightness: levels[scene][index] || 30, color: 'warm' }])) as TwinDemoState['lights'] };
}
export function updateDemoLight(state: TwinDemoState, id: DemoLightId, patch: Partial<DemoLight>): TwinDemoState {
  const light = { ...state.lights[id], ...patch };
  light.brightness = Math.max(0, Math.min(100, Number.isFinite(light.brightness) ? light.brightness : 0));
  if (patch.on === true && patch.brightness === undefined && light.brightness === 0) light.brightness = 30;
  return { ...state, lights: { ...state.lights, [id]: light } };
}
export const demoLightLevel = (light: DemoLight) => light.on ? light.brightness / 100 : 0;
