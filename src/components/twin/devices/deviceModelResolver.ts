import type { ComponentType } from 'react';
import { LightModel, FanModel, AirConditionerModel, TvModel, CameraModel, DoorModel, WindowModel, CurtainModel, GenericDeviceModel, type DeviceModelProps } from './models';

const models: Record<string, ComponentType<DeviceModelProps>> = {
  LIGHT: LightModel, LED_RGB: LightModel, FAN: FanModel,
  AC: AirConditionerModel, AIR_CONDITIONER: AirConditionerModel,
  TV: TvModel, CAMERA: CameraModel, CAMERA_AI: CameraModel, DOOR: DoorModel,
  WINDOW: WindowModel, CURTAIN: CurtainModel, BLIND: CurtainModel,
};
// IR_REMOTE stays generic: its appliance type cannot be inferred from hardware.
export const resolveDeviceModel = (type: string) => models[type] ?? GenericDeviceModel;
