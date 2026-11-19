import type { ComponentType } from 'react';
import { LightModel, CameraModel, DoorModel, WindowModel, CurtainModel, GenericDeviceModel, type DeviceModelProps } from './models';
import { CeilingLightModel, StandingLampModel, WallLightModel, LedStripModel, PlugModel, RemoteModel, SensorModel } from './ApplianceModels';
import { AirConditionerDevice, CeilingFanDevice, RollerDoorDevice, StandingFanDevice, TvDevice } from './GltfDeviceModels';
import { resolveDeviceAppearance, type DeviceModelKind } from './deviceAppearance';

const models: Record<DeviceModelKind, ComponentType<DeviceModelProps>> = {
  'ceiling-light': CeilingLightModel, 'pendant-light': LightModel, 'floor-lamp': StandingLampModel, 'table-lamp': StandingLampModel,
  'wall-light': WallLightModel, 'led-strip': LedStripModel, 'ceiling-fan': CeilingFanDevice, 'standing-fan': StandingFanDevice,
  ac: AirConditionerDevice, tv: TvDevice, camera: CameraModel, door: DoorModel, 'roller-door': RollerDoorDevice, window: WindowModel, curtain: CurtainModel,
  plug: PlugModel, remote: RemoteModel, 'climate-sensor': SensorModel, 'motion-sensor': SensorModel, 'smoke-sensor': SensorModel, generic: GenericDeviceModel,
};
export const resolveDeviceModel = (type: string, name = '') => models[resolveDeviceAppearance(type, name).kind];
