import { memo } from 'react';
import { Canvas } from '@react-three/fiber';
import type { TwinLayoutGeometry, TwinLayoutSelection } from '../../types/twinLayout';
import type { TwinHeatmapMode } from '../../types/twinView';
import type { Twin3DPalette } from './twin3dPalette';
import type { TwinDraftingMetadata } from './twinDrafting';
import type { TwinCameraRequest } from './twin3dCamera';
import { HouseScene } from './scene/HouseScene';
import { useTwinScene } from './hooks/useTwinScene';
import type { TwinFloorMode, TwinWallMode, TwinMarkerMode } from './scene/architectureMaterials';

export const Twin3DCanvas = memo(function Twin3DCanvas({ geometry, drafting, activeFloor, mode, wallMode, markerMode, selection, fitRequest, cameraRequest, focusRoomId, focusNodeKey, compact, palette, theme, heatmapMode, onSelect, onFocus, onReady, onCameraInteract }: {
  geometry: TwinLayoutGeometry;
  drafting: TwinDraftingMetadata;
  activeFloor: number | 'all';
  mode: TwinFloorMode;
  wallMode: TwinWallMode;
  markerMode: TwinMarkerMode;
  selection: TwinLayoutSelection | null;
  fitRequest: number;
  cameraRequest: TwinCameraRequest;
  focusRoomId: string | null;
  focusNodeKey: string | null;
  compact: boolean;
  palette: Twin3DPalette; theme: import('./scene/rendererTheme').TwinRendererTheme;
  heatmapMode: TwinHeatmapMode;
  onFocus: (selection: TwinLayoutSelection) => void;
  onSelect: (selection: TwinLayoutSelection | null) => void;
  onReady: () => void;
  onCameraInteract: () => void;
}) {
  const house = useTwinScene(geometry, drafting);
  return <Canvas aria-label="Mô hình nhà 3D" shadows={compact ? false : 'percentage'} frameloop="demand" dpr={[1, compact ? 1.2 : 1.5]} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} onCreated={onReady}>
    <HouseScene house={house} geometry={geometry} drafting={drafting} activeFloor={activeFloor} mode={mode} wallMode={wallMode} markerMode={markerMode} selection={selection} fitRequest={fitRequest} cameraRequest={cameraRequest} focusRoomId={focusRoomId} focusNodeKey={focusNodeKey} compact={compact} palette={palette} theme={theme} heatmapMode={heatmapMode} onFocus={onFocus} onSelect={onSelect} onCameraInteract={onCameraInteract} />
  </Canvas>;
});
