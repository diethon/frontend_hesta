import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { AdaptiveDpr, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { TOUCH } from 'three';
import type { TwinHouseView, TwinHeatmapMode } from '../../../types/twinView';
import type { TwinLayoutGeometry, TwinLayoutSelection } from '../../../types/twinLayout';
import type { TwinDraftingMetadata } from '../twinDrafting';
import type { Twin3DPalette } from '../twin3dPalette';
import type { TwinCameraRequest } from '../twin3dCamera';
import { CAMERA_MIN_POLAR, CAMERA_MAX_POLAR } from '../twin3dCamera';
import { FitCamera } from './FitCamera';
import { FloorScene } from './FloorScene';
import { themeEnvironment } from './rendererTheme';
import { EXPLODE_GAP, roomBounds } from './cameraFraming';
import type { TwinFloorMode, TwinWallMode, TwinMarkerMode } from './architectureMaterials';

export function HouseScene({ house, drafting, activeFloor, mode, wallMode, markerMode, selection, fitRequest, cameraRequest, focusRoomId, focusNodeKey, compact, palette, theme, heatmapMode, onSelect, onFocus, onCameraInteract }: {
  house: TwinHouseView; geometry: TwinLayoutGeometry; drafting: TwinDraftingMetadata; activeFloor: number | 'all'; mode: TwinFloorMode; wallMode: TwinWallMode; markerMode: TwinMarkerMode;
  selection: TwinLayoutSelection | null; fitRequest: number; cameraRequest: TwinCameraRequest; focusRoomId: string | null; focusNodeKey: string | null;
  compact: boolean; palette: Twin3DPalette; theme: import('./rendererTheme').TwinRendererTheme; heatmapMode: TwinHeatmapMode; onSelect: (selection: TwinLayoutSelection | null) => void; onFocus: (selection: TwinLayoutSelection) => void; onCameraInteract: () => void;
}) {
  const get = useThree(state => state.get), invalidate=useThree(state=>state.invalidate);
  const environment=themeEnvironment[theme];
  const regress=useThree(state=>state.performance.regress);
  useEffect(()=>{get().gl.toneMappingExposure=environment.exposure;invalidate();},[get,environment, invalidate]);
  const floors = useMemo(() => house.floors.filter((floor) => mode !== 'single' || floor.level === activeFloor), [house, mode, activeFloor]);
  const offsets = useMemo(() => new Map(house.floors.map((floor, rank) => [floor.id, mode === 'single' ? 0 : (floor.rooms[0]?.y ?? 0) + (mode === 'exploded' ? rank * EXPLODE_GAP : 0)])), [house, mode]);
  const rooms = useMemo(() => floors.flatMap((floor) => floor.rooms.map((room) => ({ ...room, y: offsets.get(floor.id) ?? 0 }))), [floors, offsets]);
  const focusRoom = rooms.find((room) => room.roomId === focusRoomId);
  const focusNode = useMemo(() => {
    const floor = floors.find((floor) => floor.nodes.some((item) => `${item.nodeType}:${item.nodeId}` === focusNodeKey));
    const node = floor?.nodes.find((item) => `${item.nodeType}:${item.nodeId}` === focusNodeKey);
    return floor && node ? { ...node, y: (offsets.get(floor.id) ?? 0) + 1.5 } : undefined;
  }, [floors, offsets, focusNodeKey]);
  const box = roomBounds(rooms), maxY = Math.max(0, ...rooms.map((room) => room.y + room.wallHeight));
  const bounds = { centerX: (box.min.x + box.max.x) / 2, centerZ: (box.min.z + box.max.z) / 2, width: box.max.x - box.min.x, depth: box.max.z - box.min.z };
  return <>
    <color attach="background" args={[palette.infoSoft]} />
    <PerspectiveCamera makeDefault fov={38} near={.05} far={200} position={[-14, 18, 20]} />
    <AdaptiveDpr />
    <OrbitControls makeDefault enablePan enableDamping dampingFactor={.12} minDistance={2} maxDistance={100} minPolarAngle={CAMERA_MIN_POLAR} maxPolarAngle={CAMERA_MAX_POLAR} rotateSpeed={compact ? .85 : 1} zoomSpeed={.8} touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }} onStart={()=>{regress();onCameraInteract();}} />
    <hemisphereLight args={[environment.sky, palette.ground, environment.hemisphere]} />
    <directionalLight castShadow color={environment.sky} intensity={environment.sun} position={[-8, 16 + maxY, 8]} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-camera-far={80} shadow-mapSize-width={compact || rooms.length > 18 ? 512 : 1024} shadow-mapSize-height={compact || rooms.length > 18 ? 512 : 1024} shadow-normalBias={.025} shadow-bias={-.0002} shadow-radius={4} />
    <directionalLight color={environment.sky} intensity={environment.fill} position={[9, 8, -10]} />
    <FitCamera rooms={rooms} room={focusRoom} node={focusNode} request={fitRequest} cameraRequest={cameraRequest} />
    {floors.map((floor) => <FloorScene key={floor.id} floor={floor} targetElevation={offsets.get(floor.id) ?? 0} mode={mode} wallMode={wallMode} markerMode={markerMode} drafting={drafting} selection={selection} compact={compact} showLabels={floors.length === 1 || mode === 'single'} palette={palette} theme={theme} heatmapMode={heatmapMode} onSelect={onSelect} onFocus={onFocus} />)}
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[bounds.centerX, -.24, bounds.centerZ]} onClick={(event) => { if (event.delta <= 3) onSelect(null); }}><planeGeometry args={[bounds.width + 2, bounds.depth + 2]} /><meshStandardMaterial color={palette.ground} roughness={1} /></mesh>
  </>;
}
