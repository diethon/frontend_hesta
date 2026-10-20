import React from 'react';
import type { SceneActionType } from '../../types/scene';
import type { AnyDevice, DraftSceneAction } from './sceneActions';
import { DeviceMultiActionCard } from '../device/DeviceMultiActionCard';

export interface SceneDeviceActionCardProps {
  action: DraftSceneAction;
  index: number;
  totalActions: number;
  devices: AnyDevice[];
  allowedTypes?: SceneActionType[];
  onUpdate: (patch: Partial<DraftSceneAction>) => void;
  onChangeDevice: (deviceId: string) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export const SceneDeviceActionCard: React.FC<SceneDeviceActionCardProps> = ({
  action,
  index,
  totalActions,
  devices,
  onUpdate,
  onChangeDevice,
  onMove,
  onRemove,
  disabled = false,
}) => {
  return (
    <DeviceMultiActionCard
      action={action}
      index={index}
      totalActions={totalActions}
      devices={devices}
      onUpdate={(patch) =>
        onUpdate({
          action: patch.action as any,
          value: patch.value,
        })
      }
      onChangeDevice={onChangeDevice}
      onMove={onMove}
      onRemove={onRemove}
      disabled={disabled}
      stepLabel="Bước"
    />
  );
};
