import type { RootState } from './store';
import { createSelector } from '@reduxjs/toolkit';

export const selectTwin = (state: RootState) => state.twin;
export const selectTwinDevice = (state: RootState, deviceId: string) => state.twin.devicesById[deviceId];
export const selectTwinSensor = (state: RootState, sensorId: string) => state.twin.sensorsById[sensorId];
export const selectTwinRoom = (state: RootState, roomId: string) => state.twin.roomsById[roomId];

export const selectTwinHealthCounts = createSelector(
  [(state: RootState) => state.twin.devicesById, (state: RootState) => state.twin.sensorsById],
  (devices, sensors) => {
    const counts = { ACTIVE: 0, STALE: 0, OFFLINE: 0 };
    for (const node of [...Object.values(devices), ...Object.values(sensors)]) counts[node.healthStatus]++;
    return counts;
  },
);
