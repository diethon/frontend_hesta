import { createElement, useMemo } from 'react';
import type { TwinDeviceSnapshotResponse } from '../../types/twin';
import type { Twin3DPalette } from './twin3dPalette';
import { adaptTwinDevice } from '../../services/twinAdapter';
import { resolveDeviceModel } from './devices/deviceModelResolver';
import { resolveDeviceAppearance } from './devices/deviceAppearance';
import type { OpeningInfo } from './neonplan/viewer/build';

export function Twin3DDeviceVisual({ device, palette, opening }: { device: TwinDeviceSnapshotResponse; palette: Twin3DPalette; opening?: OpeningInfo }) {
  const view = useMemo(() => adaptTwinDevice(device), [device]);
  const appearance = resolveDeviceAppearance(view.type, view.name);
  return <group userData={{ modelKind: appearance.kind, modelSource: appearance.source, modelMount: appearance.mount }} name={`model:${appearance.kind}`}>{createElement(resolveDeviceModel(view.type, view.name), { device: view, palette, opening, appearance })}</group>;
}
