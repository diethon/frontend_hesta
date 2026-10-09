import { createElement, useMemo } from 'react';
import type { TwinDeviceSnapshotResponse } from '../../types/twin';
import type { Twin3DPalette } from './twin3dPalette';
import { adaptTwinDevice } from '../../services/twinAdapter';
import { resolveDeviceModel } from './devices/deviceModelResolver';
import type { OpeningInfo } from './neonplan/viewer/build';

export function Twin3DDeviceVisual({ device, palette, opening }: { device: TwinDeviceSnapshotResponse; palette: Twin3DPalette; opening?: OpeningInfo }) {
  const view = useMemo(() => adaptTwinDevice(device), [device]);
  return createElement(resolveDeviceModel(view.type), { device: view, palette, opening });
}
