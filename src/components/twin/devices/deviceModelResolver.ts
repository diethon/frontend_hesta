import type { ComponentType } from 'react';
import { LightModel, FanModel, AirConditionerModel, TvModel, CameraModel, DoorModel, WindowModel, CurtainModel, GenericDeviceModel, type DeviceModelProps } from './models';
import { CeilingLightModel, StandingLampModel, WallLightModel, LedStripModel, StandingFanModel, PlugModel, RemoteModel, SensorModel } from './ApplianceModels';
import { resolveDeviceAppearance, type DeviceModelKind } from './deviceAppearance';

const models: Record<DeviceModelKind, ComponentType<DeviceModelProps>> = {
  'ceiling-light': CeilingLightModel, 'pendant-light': LightModel, 'floor-lamp': StandingLampModel, 'table-lamp': StandingLampModel,
  'wall-light': WallLightModel, 'led-strip': LedStripModel, 'ceiling-fan': FanModel, 'standing-fan': StandingFanModel,
  ac: AirConditionerModel, tv: TvModel, camera: CameraModel, door: DoorModel, window: WindowModel, curtain: CurtainModel,
  plug: PlugModel, remote: RemoteModel, 'climate-sensor': SensorModel, 'motion-sensor': SensorModel, 'smoke-sensor': SensorModel, generic: GenericDeviceModel,
};
export const resolveDeviceModel = (type: string, name = '') => models[resolveDeviceAppearance(type, name).kind];
