import React from 'react';
import type { DeviceResponse } from '../../types/device';
import {
  isAcDevice,
  resolveEffectiveType,
  getPowerState,
  isControllable,
  isWideCard,
} from './deviceHelpers';

import { AcCard } from './cards/AcCard';
import { LightCard } from './cards/LightCard';
import { SensorCard } from './cards/SensorCard';
import { GateCard } from './cards/GateCard';
import { CameraCard } from './cards/CameraCard';
import { GenericCard } from './cards/GenericCard';

export {
  isAcDevice,
  resolveEffectiveType,
  getPowerState,
  isControllable,
  isWideCard,
};

export interface DeviceCardProps {
  device: DeviceResponse;
  powerPending?: boolean;
  onTogglePower?: (deviceId: string, currentPower: string) => void;
  onClick?: (deviceId: string) => void;
  onStateChange?: (updatedDevice: DeviceResponse) => void;
}

/**
 * Modern Differentiated Smart Home Device Card.
 * Dispatches specialized UI cards with inline controls according to device type.
 */
export const DeviceCard: React.FC<DeviceCardProps> = (props) => {
  const effectiveType = resolveEffectiveType(props.device);

  switch (effectiveType) {
    case 'AIR_CONDITIONER':
      return <AcCard {...props} />;

    case 'LIGHT':
    case 'LED_RGB':
    case 'SMART_PLUG':
      return <LightCard {...props} />;

    case 'TEMP_HUMID_SENSOR':
    case 'MOTION_SENSOR':
    case 'SMOKE_SENSOR':
      return <SensorCard device={props.device} onClick={props.onClick} />;

    case 'GATE':
    case 'ROLLING_DOOR':
      return (
        <GateCard
          device={props.device}
          onClick={props.onClick}
          onStateChange={props.onStateChange}
        />
      );

    case 'CAMERA_AI':
      return <CameraCard device={props.device} onClick={props.onClick} />;

    default:
      return <GenericCard {...props} />;
  }
};
