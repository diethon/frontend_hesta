import { memo, useEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { shallowEqual } from 'react-redux';
import { DoubleSide, Group, MultiplyBlending, type Mesh, type Raycaster, type Intersection } from 'three';
import { useAppSelector } from '../../../store/hooks';
import type { TwinFloorView, TwinHeatmapMode } from '../../../types/twinView';
import type { TwinLayoutSelection } from '../../../types/twinLayout';
import type { TwinDraftingMetadata } from '../twinDrafting';
import type { Twin3DPalette } from '../twin3dPalette';
import { adaptTwinArchitecture } from '../../../services/twinArchitectureAdapter';
import { buildFloorGeometry } from '../neonplan/viewer/build';
import { buildOpeningParts } from '../neonplan/viewer/openings';
import { type FoldMasks } from '../neonplan/viewer/fold';
import { architectureMaterials, architecturalRaycast, disposeGeometries, updateWallMasks, type TwinWallMode, type TwinMarkerMode, type TwinFloorMode } from './architectureMaterials';
import { RoomScene } from './RoomScene';
import { Twin3DDevice, Twin3DSensor } from './SceneNodes';
import { useReducedMotion } from '../useTwinMotion';
import { GeoBuffer } from '../neonplan/viewer/geo';
import { pushLampModel } from '../neonplan/viewer/lamps';
import { makePatternTexture, patternMaterial } from '../neonplan/viewer/pattern';
import { TwinCutawayContext } from './TwinCutawayContext';
import { themeMaterial, themeIndex, type TwinRendererTheme } from './rendererTheme';
import { useTwinResource } from '../hooks/useTwinResource';

export interface FloorProps {
  floor: TwinFloorView; drafting: TwinDraftingMetadata; selection: TwinLayoutSelection | null;
  targetElevation: number; mode: TwinFloorMode; wallMode: TwinWallMode; markerMode: TwinMarkerMode;
  compact: boolean; showLabels: boolean; palette: Twin3DPalette; theme: TwinRendererTheme; heatmapMode: TwinHeatmapMode;
  onSelect: (selection: TwinLayoutSelection) => void; onFocus: (selection: TwinLayoutSelection) => void;
}
export const FloorScene = memo(function FloorScene({ floor, drafting, selection, targetElevation, mode, wallMode, markerMode, showLabels, palette, theme, heatmapMode, onSelect, onFocus }: FloorProps) {
  const names = useAppSelector((state) => Object.fromEntries(floor.rooms.map((room) => [room.roomId, state.twin.roomsById[room.roomId]?.name ?? ''])), shallowEqual);
  const architecture = useMemo(() => adaptTwinArchitecture(floor, drafting, names), [floor, drafting, names]);
  const built = useMemo(() => buildFloorGeometry(architecture.floor, architecture.exteriorThickness, architecture.interiorThickness), [architecture]);
  const deviceTypes = useAppSelector((state) => JSON.stringify(floor.nodes.filter((node) => node.nodeType === 'DEVICE').map((node) => [node.nodeId, state.twin.devicesById[node.nodeId]?.deviceType ?? ''])));
  const openingBindings = useMemo(() => {
    const result = new Map<string, typeof built.openings[number]>(), occupied = new Set<string>();
    const types = new Map<string, string>(JSON.parse(deviceTypes));
    for (const node of floor.nodes) {
      const type = types.get(node.nodeId);
      if (!type || !['DOOR', 'WINDOW', 'CURTAIN', 'BLIND'].includes(type)) continue;
      const opening = built.openings.filter((info) => info.opening.room_id === node.roomId && info.opening.type === (type === 'DOOR' ? 'door' : 'window') && !occupied.has(info.opening.id)).sort((a, b) => Math.hypot(a.start[0] + a.axis[0] * a.width / 2 - node.x, a.start[1] + a.axis[1] * a.width / 2 - node.z) - Math.hypot(b.start[0] + b.axis[0] * b.width / 2 - node.x, b.start[1] + b.axis[1] * b.width / 2 - node.z))[0];
      if (opening) { result.set(node.nodeId, opening); occupied.add(opening.opening.id); }
    }
    return result;
  }, [built, floor.nodes, deviceTypes]);
  const openings = useMemo(() => buildOpeningParts(built.openings.filter((info) => ![...openingBindings.values()].includes(info)), new Map(), architecture.floor.cut_height), [built, architecture, openingBindings]);
  const masks = useMemo<FoldMasks>(() => ({ standing: { value: 0xffff }, glass: { value: 0 } }), []);
  const themeUniform = useMemo(()=>({value:0}),[]);
  const materials = useMemo(() => { const values=architectureMaterials(masks); Object.values(values).forEach(m=>themeMaterial(m,themeUniform)); return values; }, [masks,themeUniform]);
  useEffect(()=>{themeUniform.value=themeIndex(theme);},[theme,themeUniform]);
  const cutaway = useMemo(() => ({ masks, cutHeight: architecture.floor.cut_height, themeUniform }), [masks, architecture.floor.cut_height, themeUniform]);
  const patternTexture=useTwinResource('floor-pattern-atlas',makePatternTexture);
  const pattern = useMemo(() => ({texture:patternTexture, material:patternMaterial(patternTexture)}), [patternTexture]);
  const lamps = useMemo(() => {
    const buffer = new GeoBuffer();
    architecture.floor.furniture.filter((f) => f.type.startsWith('lamp_')).forEach((f) => pushLampModel(buffer, { x: f.x, z: f.z, lamp: 'floor', size: [f.w, f.d, f.h], rotation: f.rotation }, architecture.floor.height, 0xdacdb9));
    return buffer.geometry();
  }, [architecture]);
  const group = useRef<Group>(null), elevation = useRef(targetElevation);
  const invalidate = useThree((state) => state.invalidate), reduced = useReducedMotion();
  useEffect(() => { invalidate(); }, [targetElevation, wallMode, invalidate]);
  useEffect(() => () => { disposeGeometries(built); }, [built]);
  useEffect(() => () => { disposeGeometries(openings); }, [openings]);
  useEffect(() => () => { lamps.dispose(); }, [lamps]);
  useEffect(() => () => { Object.values(materials).forEach((material) => material.dispose()); }, [materials]);
  useEffect(() => () => { pattern.material.dispose(); }, [pattern]);
  useFrame(({ camera, controls }, dt) => {
    if (!group.current) return;
    elevation.current += (targetElevation - elevation.current) * (reduced ? 1 : 1 - Math.exp(-Math.min(dt, .05) * 14));
    group.current.position.y = elevation.current;
    if (Math.abs(targetElevation - elevation.current) > .001) invalidate();
    const target = controls && 'target' in controls ? controls.target as { x: number; z: number } : { x: 0, z: 0 };
    updateWallMasks(masks, built.buckets, camera.position.x - target.x, camera.position.z - target.z, wallMode);
  });
  const selectArchitecture = (event: ThreeEvent<MouseEvent>, focus: boolean) => {
    const hit = built.furnitureTris.find((range) => (event.faceIndex ?? -1) >= range.start && (event.faceIndex ?? -1) < range.end);
    const roomId = hit ? architecture.furnitureRooms.get(hit.id) : undefined;
    if (roomId) { event.stopPropagation(); (focus ? onFocus : onSelect)({ kind: 'room', id: roomId }); }
  };
  const raycast = useMemo(() => function(this: Mesh, raycaster: Raycaster, hits: Intersection[]) { architecturalRaycast.call(this, raycaster, hits, masks); }, [masks]);
  return <TwinCutawayContext.Provider value={cutaway}><group ref={group} name={floor.id} position={[0, targetElevation, 0]}>
    <mesh geometry={built.floor} material={materials.floor} receiveShadow castShadow />
    <mesh geometry={built.floor} material={pattern.material} raycast={() => undefined} />
    <mesh geometry={built.walls} material={materials.walls} customDepthMaterial={materials.depth} castShadow receiveShadow raycast={raycast} onClick={(event) => selectArchitecture(event, false)} onDoubleClick={(event) => selectArchitecture(event, true)} />
    <mesh geometry={built.walls} material={materials.glassWalls} raycast={() => undefined} renderOrder={3} />
    <lineSegments geometry={built.lines} material={materials.lines} raycast={() => undefined} />
    <mesh geometry={built.shadow} raycast={() => undefined}><meshBasicMaterial vertexColors blending={MultiplyBlending} transparent depthWrite={false} side={DoubleSide} polygonOffset polygonOffsetFactor={-1} /></mesh>
    <mesh geometry={openings.frames} material={materials.frames} receiveShadow raycast={() => undefined} />
    <mesh geometry={openings.glass} material={materials.windowGlass} raycast={() => undefined} renderOrder={4} />
    <mesh geometry={openings.blinds} material={materials.blinds} raycast={() => undefined} />
    <mesh geometry={lamps} castShadow><meshStandardMaterial vertexColors roughness={.75} /></mesh>
    {architecture.floor.rooms.map((room) => <RoomScene key={room.id} room={room} selected={selection?.kind === 'room' && selection.id === room.id} showLabel={showLabels} palette={palette} heatmapMode={heatmapMode} onSelect={onSelect} onFocus={onFocus} />)}
    {floor.nodes.map((node) => {
      const room = floor.rooms.find((r) => r.roomId === node.roomId), selected = selection?.kind === 'node' && selection.id === `${node.nodeType}:${node.nodeId}`;
      return node.nodeType === 'DEVICE'
        ? <Twin3DDevice key={`DEVICE:${node.nodeId}`} node={node} room={room} opening={openingBindings.get(node.nodeId)} rotation={drafting.nodeRotations?.[`DEVICE:${node.nodeId}`] ?? 0} selected={selected} markerMode={markerMode} houseOverview={mode === 'house' && !showLabels} palette={palette} onSelect={onSelect} onFocus={onFocus} />
        : <Twin3DSensor key={`SENSOR:${node.nodeId}`} node={node} selected={selected} markerMode={markerMode} houseOverview={mode === 'house' && !showLabels} palette={palette} onSelect={onSelect} onFocus={onFocus} />;
    })}
    {mode === 'exploded' ? <Html position={[Math.min(...architecture.floor.rooms.flatMap((room) => room.points.map((p) => p[0]))) - .5, .5, 0]} center zIndexRange={[10, 0]}><span data-twin-floor-label className="pointer-events-none whitespace-nowrap rounded-lg border border-line bg-surface/90 px-2 py-1 text-xs font-semibold text-muted">{floor.name}</span></Html> : null}
  </group></TwinCutawayContext.Provider>;
});
