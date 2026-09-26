import type { RootState } from './store';

export const selectTwin = (state: RootState) => state.twin;
export const selectTwinDevice = (state: RootState, deviceId: string) => state.twin.devicesById[deviceId];
export const selectTwinSensor = (state: RootState, sensorId: string) => state.twin.sensorsById[sensorId];
export const selectTwinRoom = (state: RootState, roomId: string) => state.twin.roomsById[roomId];
