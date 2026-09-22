import { memo, useEffect, useMemo, useRef } from 'react';
import { Shape, type Mesh } from 'three';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Bounds, Edges, Html, OrbitControls, PerspectiveCamera, useBounds } from '@react-three/drei';
import { useAppSelector } from '../../store/hooks';
import type { TwinHealthStatus, JsonValue } from '../../types/twin';
import type { TwinLayoutGeometry, TwinLayoutSelection } from '../../types/twinLayout';
import { DeviceGlyph, SensorGlyph } from './TwinVisualIcon';
import { roomKind } from './roomKind';
import {
  TWIN_FLOOR_HEIGHT,
  TWIN_MARKER_ELEVATION,
  cameraPoseForBounds,
  floorElevation,
  geometryForFloor,
  homeBounds,
  layoutFloors,
  resolvePlacedNodes,
  roomFloorLevel,
  roomToWorldWithDrafting,
  type Twin3DNodeGeometry,
  type Twin3DShapedRoomGeometry,
} from './twin3dGeometry';
import type { Twin3DPalette } from './twin3dPalette';
import { Twin3DLandscape, Twin3DRoomDecor } from './Twin3DDecor';
import { roomDrafting, type TwinDraftingMetadata } from './twinDrafting';

const healthMarkerStyles: Record<TwinHealthStatus, string> = {
  ACTIVE: 'border-success bg-success-soft',
  STALE: 'border-warning bg-warning-soft',
  OFFLINE: 'border-off bg-off-soft opacity-75',
};

const healthSymbols: Record<TwinHealthStatus, string> = { ACTIVE: 'A', STALE: '!', OFFLINE: '×' };

function powerSummary(state: JsonValue) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return '—';
  const power = state.power;
  return power === true ? 'ON' : power === false ? 'OFF' : typeof power === 'string' ? power : '—';
}

function FitCamera({ request }: { request: number }) {
  const bounds = useBounds();
  useEffect(() => { bounds.refresh().clip().fit(); }, [bounds, request]);
  return null;
}

function roomFloorColor(name: string, palette: Twin3DPalette) {
  return { living: palette.woodLight, bedroom: palette.rug, kitchen: palette.surface, bathroom: palette.infoSoft, other: palette.offSoft }[roomKind(name)];
}

const Twin3DRoom = memo(function Twin3DRoom({ room, selected, compact, showLabel, palette, onSelect }: {
  room: Twin3DShapedRoomGeometry;
  selected: boolean;
  compact: boolean;
  showLabel: boolean;
  palette: Twin3DPalette;
  onSelect: (selection: TwinLayoutSelection) => void;
}) {
  const runtime = useAppSelector((state) => state.twin.roomsById[room.roomId]);
  const name = runtime?.name ?? 'Phòng không còn trong dữ liệu';
  const wallY = TWIN_FLOOR_HEIGHT + room.wallHeight / 2;
  const wallMeshes = useRef<Array<Mesh | null>>([]);
  const floorShape = useMemo(() => {
    const shape = new Shape();
    room.outline.forEach((point, index) => {
      const sourceY = -point.z;
      if (index === 0) shape.moveTo(point.x, sourceY);
      else shape.lineTo(point.x, sourceY);
    });
    shape.closePath();
    return shape;
  }, [room.outline]);
  const walls = useMemo(() => {
    const signedArea = room.outline.reduce((area, point, index) => {
      const next = room.outline[(index + 1) % room.outline.length];
      return area + point.x * next.z - next.x * point.z;
    }, 0);
    const direction = signedArea >= 0 ? 1 : -1;
    return room.outline.map((start, index) => {
    const end = room.outline[(index + 1) % room.outline.length];
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.max(Math.hypot(dx, dz), 0.001);
    return {
      key: `${index}-${start.x}-${start.z}`,
      x: (start.x + end.x) / 2,
      z: (start.z + end.z) / 2,
      length: length + room.wallThickness,
      rotation: -Math.atan2(dz, dx),
      normalX: direction * dz / length,
      normalZ: -direction * dx / length,
    };
    });
  }, [room.outline, room.wallThickness]);
  useFrame(({ camera }) => {
    walls.forEach((wall, index) => {
      const mesh = wallMeshes.current[index];
      if (!mesh) return;
      const cameraSide = wall.normalX * (camera.position.x - room.x - wall.x)
        + wall.normalZ * (camera.position.z - room.z - wall.z);
      const height = cameraSide > 0 ? 0.28 : 1;
      mesh.scale.y = height;
      mesh.position.y = TWIN_FLOOR_HEIGHT + room.wallHeight * height / 2;
    });
  });
  const labelPosition: [number, number, number] = [
    -Math.sign(room.x) * Math.min(0.45, room.width * 0.08),
    room.wallHeight + 0.7,
    -Math.sign(room.z) * Math.min(0.35, room.depth * 0.08),
  ];
  const select = (event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); onSelect({ kind: 'room', id: room.roomId }); };
  return <group position={[room.x, room.y, room.z]}>
    <mesh receiveShadow onPointerDown={select} rotation={[-Math.PI / 2, 0, 0]} position={[0, TWIN_FLOOR_HEIGHT, 0]}>
      <shapeGeometry args={[floorShape]} />
      <meshStandardMaterial color={roomFloorColor(name, palette)} roughness={0.9} emissive={selected ? palette.primary : palette.surface} emissiveIntensity={selected ? 0.12 : 0} />
      <Edges color={selected ? palette.primaryHover : palette.line} threshold={20} />
    </mesh>
    <Twin3DRoomDecor room={room} name={name} palette={palette} compact={compact} shaped={room.customShape} onSelect={select} />
    {walls.map((wall, index) => <mesh key={wall.key} ref={(mesh) => { wallMeshes.current[index] = mesh; }} castShadow receiveShadow onPointerDown={select} position={[wall.x, wallY, wall.z]} rotation={[0, wall.rotation, 0]}>
      <boxGeometry args={[wall.length, room.wallHeight, room.wallThickness]} />
      <meshStandardMaterial color={selected ? palette.primary : palette.surface} roughness={0.68} metalness={0.02} />
      <Edges color={selected ? palette.primaryHover : palette.line} threshold={25} />
    </mesh>)}
    {showLabel ? <Html center transform sprite distanceFactor={10} position={labelPosition} zIndexRange={[30, 10]}>
      <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onSelect({ kind: 'room', id: room.roomId }); }} className={`twin-3d-room-label min-w-28 rounded-xl border bg-surface/95 px-3 py-2 text-left shadow-float ${selected ? 'border-primary ring-2 ring-primary/30' : 'border-line'}`}>
        <strong className="block truncate text-xs text-text">{name}</strong>
        <span className="mt-0.5 block text-[10px] font-medium text-muted">{runtime ? `${runtime.deviceIds.length} thiết bị · ${runtime.sensorIds.length} cảm biến` : 'Không còn dữ liệu'}</span>
      </button>
    </Html> : null}
  </group>;
});

function MarkerShell({ node, selected, healthStatus, unpaired = false, label, detail, palette, children, onSelect }: {
  node: Twin3DNodeGeometry;
  selected: boolean;
  healthStatus: TwinHealthStatus;
  unpaired?: boolean;
  label: string;
  detail: string;
  palette: Twin3DPalette;
  children: React.ReactNode;
  onSelect: (selection: TwinLayoutSelection) => void;
}) {
  const selection = { kind: 'node', id: `${node.nodeType}:${node.nodeId}` } as const;
  const select3D = (event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); onSelect(selection); };
  return <group position={[node.x, node.y, node.z]}>
    <mesh castShadow onPointerDown={select3D} position={[0, -TWIN_MARKER_ELEVATION / 2, 0]}>
      <cylinderGeometry args={[0.18, 0.24, TWIN_MARKER_ELEVATION, 24]} />
      <meshStandardMaterial color={unpaired ? palette.primary : healthStatus === 'ACTIVE' ? palette.success : healthStatus === 'STALE' ? palette.warning : palette.off} roughness={0.48} metalness={0.08} />
    </mesh>
    <mesh onPointerDown={select3D} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
      <torusGeometry args={[selected ? 0.34 : 0.28, selected ? 0.055 : 0.035, 12, 32]} />
      <meshStandardMaterial color={selected ? palette.primaryHover : palette.surface} emissive={selected ? palette.primary : palette.surface} emissiveIntensity={selected ? 0.5 : 0.1} />
    </mesh>
    <Html center distanceFactor={11} position={[0, 0.62, 0]} zIndexRange={[50, 31]}>
      <button type="button" aria-label={`${label}, ${detail}, ${healthStatus}`} aria-pressed={selected} data-world-x={node.x} data-world-y={node.y} data-world-z={node.z} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onSelect(selection); }} className={`group relative flex h-12 w-12 items-center justify-center rounded-2xl border shadow-float ${unpaired ? 'border-primary bg-info-soft' : healthMarkerStyles[healthStatus]} ${selected ? 'ring-2 ring-primary' : ''}`}>
        {children}
        <span aria-hidden="true" className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-surface px-1 text-[9px] font-bold ${unpaired ? 'bg-info-soft text-primary-hover' : 'bg-text text-white'}`}>{unpaired ? 'M' : healthSymbols[healthStatus]}</span>
        <span aria-hidden="true" className={`pointer-events-none absolute bottom-14 left-1/2 w-40 -translate-x-1/2 rounded-xl border border-line bg-surface px-3 py-2 text-center shadow-float ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'} transition-opacity`}>
          <strong className="block truncate text-xs text-text">{label}</strong><small className="mt-0.5 block text-muted">{detail} · {healthStatus}</small>
        </span>
      </button>
    </Html>
  </group>;
}

const Twin3DDevice = memo(function Twin3DDevice({ node, selected, palette, onSelect }: { node: Twin3DNodeGeometry; selected: boolean; palette: Twin3DPalette; onSelect: (selection: TwinLayoutSelection) => void }) {
  const device = useAppSelector((state) => state.twin.devicesById[node.nodeId]);
  if (!device) return null;
  const unpaired = device.status === 'UNKNOWN' && device.lastSeen === null;
  return <MarkerShell node={node} selected={selected} healthStatus={device.healthStatus} unpaired={unpaired} label={device.name} detail={unpaired ? 'Thiết bị mẫu · Chưa ghép nối' : `${powerSummary(device.currentState)} · ${device.status}`} palette={palette} onSelect={onSelect}>
    <DeviceGlyph deviceType={device.deviceType} size={20} />
  </MarkerShell>;
});

const Twin3DSensor = memo(function Twin3DSensor({ node, selected, palette, onSelect }: { node: Twin3DNodeGeometry; selected: boolean; palette: Twin3DPalette; onSelect: (selection: TwinLayoutSelection) => void }) {
  const sensor = useAppSelector((state) => state.twin.sensorsById[node.nodeId]);
  if (!sensor) return null;
  const value = `${sensor.latestValue ?? '—'}${sensor.unit ? ` ${sensor.unit}` : ''}`;
  return <MarkerShell node={node} selected={selected} healthStatus={sensor.healthStatus} label={sensor.metricType} detail={value} palette={palette} onSelect={onSelect}>
    <SensorGlyph metricType={sensor.metricType} size={20} />
  </MarkerShell>;
});

function Twin3DScene({ geometry, drafting, activeFloor, exploded, selection, fitRequest, compact, palette, onSelect }: {
  geometry: TwinLayoutGeometry;
  drafting: TwinDraftingMetadata;
  activeFloor: number | 'all';
  exploded: boolean;
  selection: TwinLayoutSelection | null;
  fitRequest: number;
  compact: boolean;
  palette: Twin3DPalette;
  onSelect: (selection: TwinLayoutSelection | null) => void;
}) {
  const deviceIds = useAppSelector((state) => state.twin.deviceIds);
  const sensorIds = useAppSelector((state) => state.twin.sensorIds);
  const visibleGeometry = useMemo(() => geometryForFloor(geometry, activeFloor), [activeFloor, geometry]);
  const roomElevations = useMemo(() => new Map(visibleGeometry.rooms.map((room) => [room.roomId, activeFloor === 'all' ? floorElevation(roomFloorLevel(room), exploded) : 0])), [activeFloor, exploded, visibleGeometry.rooms]);
  const rooms = useMemo(() => visibleGeometry.rooms.map((room) => roomToWorldWithDrafting(room, roomDrafting(drafting, room.roomId), roomElevations.get(room.roomId) ?? 0)), [drafting, roomElevations, visibleGeometry.rooms]);
  const nodes = useMemo(() => resolvePlacedNodes(visibleGeometry, deviceIds, sensorIds, roomElevations), [deviceIds, roomElevations, sensorIds, visibleGeometry]);
  const bounds = useMemo(() => homeBounds(visibleGeometry.rooms), [visibleGeometry.rooms]);
  const pose = useMemo(() => cameraPoseForBounds(bounds), [bounds]);
  const maximumElevation = useMemo(() => Math.max(0, ...roomElevations.values()), [roomElevations]);
  const floorLevels = useMemo(() => layoutFloors(visibleGeometry.rooms), [visibleGeometry.rooms]);
  const multiFloorOverview = activeFloor === 'all' && floorLevels.length > 1;
  const cameraTarget: [number, number, number] = [pose.target[0], maximumElevation / 2, pose.target[2]];
  const cameraPosition: [number, number, number] = [pose.position[0], pose.position[1] + maximumElevation * .72, pose.position[2]];
  return <>
    <color attach="background" args={[palette.app]} />
    <fog attach="fog" args={[palette.app, 24, 52]} />
    <PerspectiveCamera makeDefault fov={38} near={0.1} far={120} position={cameraPosition} />
    <OrbitControls makeDefault target={cameraTarget} enableDamping dampingFactor={0.08} minDistance={pose.minDistance} maxDistance={pose.maxDistance} minPolarAngle={0.24} maxPolarAngle={Math.PI / 2 - 0.08} panSpeed={0.65} rotateSpeed={0.65} zoomSpeed={0.8} />
    <hemisphereLight args={[palette.surface, palette.line, 1.15]} />
    <directionalLight castShadow={!compact} color={palette.surface} intensity={1.65} position={[-7, 14, 9]} shadow-mapSize-width={compact ? 512 : 1536} shadow-mapSize-height={compact ? 512 : 1536} shadow-bias={-0.0004} />
    <directionalLight color={palette.warningSoft} intensity={.52} position={[8, 7, -8]} />
    <ambientLight color={palette.infoSoft} intensity={0.48} />
    {activeFloor === 'all' || activeFloor === 1 ? <Twin3DLandscape bounds={bounds} palette={palette} compact={compact} /> : null}
    <Bounds fit clip margin={floorLevels.length > 1 ? (compact ? 1.32 : 1.36) : (compact ? 1.1 : 1.16)}>
      <FitCamera request={fitRequest} />
      {rooms.map((room) => <Twin3DRoom key={room.roomId} room={room} selected={selection?.kind === 'room' && selection.id === room.roomId} compact={compact} showLabel={!multiFloorOverview} palette={palette} onSelect={onSelect} />)}
      {multiFloorOverview ? floorLevels.map((floor) => <Html key={floor} center transform sprite distanceFactor={9} position={[bounds.centerX - bounds.width / 2 - .65, floorElevation(floor, exploded) + 1.15, bounds.centerZ]} zIndexRange={[30, 10]}>
        <div data-twin-floor-label={floor} className="min-w-24 rounded-xl border border-primary bg-surface/95 px-3 py-2 text-center shadow-float"><strong className="block text-xs text-text">Tầng {floor}</strong><span className="mt-0.5 block text-[10px] text-muted">{visibleGeometry.rooms.filter((room) => roomFloorLevel(room) === floor).length} phòng</span></div>
      </Html>) : null}
      {nodes.map((node) => node.nodeType === 'DEVICE'
        ? <Twin3DDevice key={`${node.nodeType}:${node.nodeId}`} node={node} selected={selection?.kind === 'node' && selection.id === `${node.nodeType}:${node.nodeId}`} palette={palette} onSelect={onSelect} />
        : <Twin3DSensor key={`${node.nodeType}:${node.nodeId}`} node={node} selected={selection?.kind === 'node' && selection.id === `${node.nodeType}:${node.nodeId}`} palette={palette} onSelect={onSelect} />)}
    </Bounds>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[bounds.centerX, -0.2, bounds.centerZ]} onPointerDown={(event) => { event.stopPropagation(); onSelect(null); }}>
      <planeGeometry args={[Math.max(30, bounds.width + 8), Math.max(24, bounds.depth + 8)]} />
      <meshBasicMaterial color={palette.app} transparent opacity={0} depthWrite={false} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[bounds.centerX, -0.18, bounds.centerZ]} scale={[bounds.width / 2 + 2, bounds.depth / 2 + 1.8, 1]}>
      <circleGeometry args={[1, 48]} />
      <meshBasicMaterial color={palette.muted} transparent opacity={0.1} depthWrite={false} />
    </mesh>
  </>;
}

export const Twin3DCanvas = memo(function Twin3DCanvas({ geometry, drafting, activeFloor, exploded, selection, fitRequest, compact, palette, onSelect, onReady }: {
  geometry: TwinLayoutGeometry;
  drafting: TwinDraftingMetadata;
  activeFloor: number | 'all';
  exploded: boolean;
  selection: TwinLayoutSelection | null;
  fitRequest: number;
  compact: boolean;
  palette: Twin3DPalette;
  onSelect: (selection: TwinLayoutSelection | null) => void;
  onReady: () => void;
}) {
  return <Canvas aria-label="Mô hình nhà 3D" shadows={compact ? false : 'percentage'} frameloop="demand" dpr={[1, compact ? 1.2 : 1.5]} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} onCreated={onReady}>
    <Twin3DScene geometry={geometry} drafting={drafting} activeFloor={activeFloor} exploded={exploded} selection={selection} fitRequest={fitRequest} compact={compact} palette={palette} onSelect={onSelect} />
  </Canvas>;
});
