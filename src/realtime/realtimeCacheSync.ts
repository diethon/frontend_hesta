import type { RealtimeEvent } from './realtimeTypes';
import { invalidateDeviceMutations } from '../services/deviceApi';
import { invalidateSceneDevicesCache, invalidateScenesCache } from '../services/sceneApi';

/** Someone else changed server data: forget cached copies so the next page opened shows it, not a stale cache. */
export function invalidateCachesFor(event: RealtimeEvent) {
  if (event.type === 'DEVICE_STATE_CHANGED') {
    if (event.deviceId) invalidateDeviceMutations(event.deviceId);
    invalidateSceneDevicesCache(event.homeId);
  } else if (event.type === 'SCENE_CHANGED') {
    invalidateScenesCache(event.homeId);
  }
}
