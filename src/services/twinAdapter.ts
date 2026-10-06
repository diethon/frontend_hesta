import type { TwinDeviceSnapshotResponse, TwinSensorSnapshotResponse } from '../types/twin';
import type { TwinLayoutGeometry } from '../types/twinLayout';
import type { TwinDeviceView, TwinHouseView, TwinHeatmapMode } from '../types/twinView';
import { floorElevation, geometryForFloor, layoutFloors, resolvePlacedNodes, roomFloorLevel, roomToWorldWithDrafting } from '../components/twin/twin3dGeometry';
import { roomDrafting, type TwinDraftingMetadata } from '../components/twin/twinDrafting';
import { knownPower } from '../components/twin/twinPresentation';

export function adaptTwinDevice(device: TwinDeviceSnapshotResponse): TwinDeviceView {
  const online = device.status === 'ONLINE' && device.healthStatus === 'ACTIVE';
  const state = device.currentState;
  return {
    id: device.deviceId, name: device.name, type: device.deviceType, roomId: device.roomId,
    status: device.status, online,
    state: state && typeof state === 'object' && !Array.isArray(state) ? state : {},
    powered: online && knownPower(state) === true,
  };
}

/** Floors are layout storeys, not fabricated backend Floor records. */
export function adaptTwinHouse(homeId: string, geometry: TwinLayoutGeometry, drafting: TwinDraftingMetadata,
  deviceIds: readonly string[], sensorIds: readonly string[], activeFloor: number | 'all', exploded: boolean): TwinHouseView {
  const visible = geometryForFloor(geometry, activeFloor);
  const elevations = new Map(visible.rooms.map((room) => [room.roomId, activeFloor === 'all' ? floorElevation(roomFloorLevel(room), exploded) : 0]));
  // Authored wall heights determine architectural storey elevations. Empty storeys keep the default rise.
  if (!exploded && activeFloor === 'all') {
    let elevation = 0;
    const levels = layoutFloors(visible.rooms);
    levels.forEach((level, index) => {
      const layouts = visible.rooms.filter((room) => roomFloorLevel(room) === level);
      const stored = drafting.floors?.[String(level)];
      elevation = stored?.elevation ?? elevation;
      layouts.forEach((room) => elevations.set(room.roomId, elevation));
      const height = stored?.height ?? Math.max(2.25, ...layouts.map((room) => roomDrafting(drafting, room.roomId).floorHeightMeters ?? 2.25));
      elevation += (Math.max(1, (levels[index + 1] ?? level + 1) - level)) * (height + .25);
    });
  }
  const nodes = resolvePlacedNodes(visible, deviceIds, sensorIds, elevations);
  return { id: homeId, floors: layoutFloors(visible.rooms).map((level) => {
    const layouts = visible.rooms.filter((room) => roomFloorLevel(room) === level);
    const ids = new Set(layouts.map((room) => room.roomId));
    return {
      id: `${homeId}:floor:${level}`, name: `Tầng ${level}`, level,
      rooms: layouts.map((room) => roomToWorldWithDrafting(room, roomDrafting(drafting, room.roomId), elevations.get(room.roomId))),
      nodes: nodes.filter((node) => node.roomId ? ids.has(node.roomId) : level === layoutFloors(visible.rooms)[0]),
    };
  }) };
}

export const heatmapScales = {
  temperature: { label: 'Nhiệt độ', metric: 'TEMPERATURE', unit: '°C', min: 16, max: 36 },
  humidity: { label: 'Độ ẩm', metric: 'HUMIDITY', unit: '%', min: 30, max: 80 },
  'air-quality': { label: 'Chất lượng không khí', metric: 'AIR_QUALITY', unit: 'AQI', min: 0, max: 200 },
  co2: { label: 'CO₂', metric: 'CO2', unit: 'ppm', min: 400, max: 2000 },
} as const;

/** Never mix AQI, CO₂, °F or stale readings on a numeric colour scale. */
export function roomHeatmapReading(sensors: readonly TwinSensorSnapshotResponse[], mode: TwinHeatmapMode) {
  if (mode === 'normal') return null;
  const scale = heatmapScales[mode];
  const candidates = sensors.filter((sensor) => sensor.healthStatus === 'ACTIVE' && sensor.latestValue !== null
    && Number.isFinite(sensor.latestValue) && sensor.metricType.toUpperCase() === scale.metric
    && sensor.unit?.toLowerCase() === scale.unit.toLowerCase());
  const latest = candidates.reduce<TwinSensorSnapshotResponse | null>((current, sensor) =>
    !current || Date.parse(sensor.observedAt ?? '') > Date.parse(current.observedAt ?? '') ? sensor : current, null);
  return latest ? { value: latest.latestValue!, unit: scale.unit,
    ratio: Math.max(0, Math.min(1, (latest.latestValue! - scale.min) / (scale.max - scale.min))) } : null;
}
