import { useMemo } from 'react';
import { useAppSelector } from '../../../store/hooks';
import { adaptTwinHouse } from '../../../services/twinAdapter';
import type { TwinLayoutGeometry } from '../../../types/twinLayout';
import type { TwinDraftingMetadata } from '../twinDrafting';

/** State/adapter boundary outside the Three.js Canvas. Geometry ignores state updates. */
export function useTwinScene(geometry: TwinLayoutGeometry, drafting: TwinDraftingMetadata) {
  const homeId = useAppSelector((state) => state.twin.homeId) ?? '';
  const deviceIds = useAppSelector((state) => state.twin.deviceIds);
  const sensorIds = useAppSelector((state) => state.twin.sensorIds);
  return useMemo(() => adaptTwinHouse(homeId, geometry, drafting, deviceIds, sensorIds, 'all', false),
    [homeId, geometry, drafting, deviceIds, sensorIds]);
}
