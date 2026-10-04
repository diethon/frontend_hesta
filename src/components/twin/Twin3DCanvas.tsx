import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Box3, Vector3, Spherical, Shape, Color, TOUCH, type Mesh, type MeshStandardMaterial } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
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
import { healthSymbols } from './twinPresentation';
import { useReducedMotion, useTwinUpdateMotion } from './useTwinMotion';
import { Twin3DDeviceVisual } from './Twin3DDeviceVisual';
import { CAMERA_MIN_POLAR, CAMERA_MAX_POLAR, cameraAngles, cameraTransitionProgress, type TwinCameraRequest } from './twin3dCamera';

const healthMarkerStyles: Record<TwinHealthStatus, string> = {
  ACTIVE: 'border-success bg-success-soft',
  STALE: 'border-warning bg-warning-soft',
  OFFLINE: 'border-off bg-off-soft opacity-75',
};

function powerSummary(state: JsonValue) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return '—';
  const power = state.power;
  return power === true ? 'ON' : power === false ? 'OFF' : typeof power === 'string' ? power : '—';
}

function FitCamera({ request, cameraRequest, room }: { request: number; cameraRequest: TwinCameraRequest; room: Twin3DShapedRoomGeometry | undefined }) {
  const bounds = useBounds();
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null;
  const get = useThree((state) => state.get);
  const reduced = useReducedMotion();
  const previousCommand = useRef<TwinCameraRequest | null>(null);
  const orbit = useMemo(() => new Spherical(), []);
  const offset = useMemo(() => new Vector3(), []);
  const animation = useRef<{
    elapsed: number; start: Spherical; end: Spherical; from: Vector3; to: Vector3;
  } | null>(null);
  useEffect(() => {
    if (!controls) return;
    const interrupt = () => { animation.current = null; };
    controls.addEventListener('start', interrupt);
    return () => controls.removeEventListener('start', interrupt);
  }, [controls]);
  useEffect(() => {
    const control = get().controls as OrbitControlsImpl | null;
    if (!control) return;
    const command = previousCommand.current !== cameraRequest ? cameraRequest.action : null;
    previousCommand.current = cameraRequest;
    // Clear residual drag inertia before starting a deliberate camera move.
    const position = camera.position.clone();
    const damping = control.enableDamping;
    control.enableDamping = false;
    control.update();
    camera.position.copy(position);
    control.update();
    control.enableDamping = damping;
    const padding = .65;
    if (room) bounds.refresh(new Box3(
      new Vector3(room.x - room.width / 2 - padding, room.y, room.z - room.depth / 2 - padding),
      new Vector3(room.x + room.width / 2 + padding, room.y + room.wallHeight + .9, room.z + room.depth / 2 + padding),
    ));
    else bounds.refresh();
    const { center, distance } = bounds.getSize();
    const start = new Spherical().setFromVector3(camera.position.clone().sub(control.target));
    const end = start.clone();
    const turning = command === 'turn-left' || command === 'turn-right';
    if (command) Object.assign(end, cameraAngles(command, start.theta, start.phi));
    end.phi = Math.max(CAMERA_MIN_POLAR, Math.min(CAMERA_MAX_POLAR, end.phi));
    control.maxDistance = Math.max(12, distance * 1.65);
    end.radius = turning ? Math.max(control.minDistance, Math.min(control.maxDistance, start.radius)) : Math.max(control.minDistance, distance);
    animation.current = { elapsed: -1, start, end, from: control.target.clone(), to: turning ? control.target.clone() : center };
    invalidate();
  }, [bounds, room, request, cameraRequest, size, camera, controls, get, invalidate]);
  useFrame((_, delta) => {
    const move = animation.current;
    if (!move || !controls) return;
    // Demand rendering can resume after a long idle; that delta must not skip the transition.
    move.elapsed = move.elapsed < 0 ? 0 : move.elapsed + delta;
    const t = cameraTransitionProgress(move.elapsed, reduced);
    orbit.set(
      move.start.radius + (move.end.radius - move.start.radius) * t,
      move.start.phi + (move.end.phi - move.start.phi) * t,
      move.start.theta + (move.end.theta - move.start.theta) * t,
    );
    controls.target.lerpVectors(move.from, move.to, t);
    camera.position.copy(controls.target).add(offset.setFromSpherical(orbit));
    controls.update();
    if (t === 1) animation.current = null;
    else invalidate();
  });
  return null;
}

function roomFloorColor(name: string, palette: Twin3DPalette) {
  return { living: palette.woodLight, bedroom: palette.rug, kitchen: palette.floorMint, bathroom: palette.floorBlue, office: palette.floorMint, other: palette.wall }[roomKind(name)];
}

const Twin3DRoom = memo(function Twin3DRoom({ room, selected, dimmed, compact, showLabel, palette, onSelect }: {
  room: Twin3DShapedRoomGeometry;
  selected: boolean;
  dimmed: boolean;
  compact: boolean;
  showLabel: boolean;
  palette: Twin3DPalette;
  onSelect: (selection: TwinLayoutSelection) => void;
}) {
  const runtime = useAppSelector((state) => state.twin.roomsById[room.roomId]);
  const [hovered, setHovered] = useState(false);
  const name = runtime?.name ?? 'Phòng không còn trong dữ liệu';
  const wallY = TWIN_FLOOR_HEIGHT + room.wallHeight / 2;
  const wallMeshes = useRef<Array<Mesh | null>>([]);
  const floorMaterial = useRef<MeshStandardMaterial>(null);
  const invalidate = useThree((state) => state.invalidate);
  const reduced = useReducedMotion();
  const floorColor = roomFloorColor(name, palette);
  const wallColor = selected ? palette.glass : palette.wall;
  const tints = useRef({ floor: new Color(), wall: new Color() });
  useEffect(() => {
    tints.current.floor.set(floorColor).lerp(tints.current.wall.set(palette.wall), dimmed ? .3 : 0);
    tints.current.wall.set(wallColor);
    invalidate();
  }, [floorColor, palette.wall, wallColor, dimmed, invalidate]);
  useEffect(() => invalidate(), [selected, hovered, dimmed, invalidate]);
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
  useFrame(({ camera }, delta) => {
    let transitioning = false;
    const blend = reduced ? 1 : 1 - Math.exp(-delta * 22);
    const updateMaterial = (material: MeshStandardMaterial, color: Color, intensity: number) => {
      material.color.lerp(color, blend);
      material.emissiveIntensity += (intensity - material.emissiveIntensity) * blend;
      if (Math.abs(material.emissiveIntensity - intensity) > .001 || Math.abs(material.color.r - color.r) + Math.abs(material.color.g - color.g) + Math.abs(material.color.b - color.b) > .001) transitioning = true;
    };
    if (floorMaterial.current) updateMaterial(floorMaterial.current, tints.current.floor, selected ? .24 : hovered ? .1 : 0);
    walls.forEach((wall, index) => {
      const mesh = wallMeshes.current[index];
      if (!mesh) return;
      const cameraSide = wall.normalX * (camera.position.x - room.x - wall.x)
        + wall.normalZ * (camera.position.z - room.z - wall.z);
      // A soft cutaway avoids walls popping when the orbit crosses a room edge.
      const facing = Math.max(0, Math.min(1, (cameraSide + .5) / 1));
      const height = 1 - .72 * facing * facing * (3 - 2 * facing);
      mesh.scale.y += (height - mesh.scale.y) * blend;
      if (Math.abs(height - mesh.scale.y) > .001) transitioning = true;
      mesh.position.y = TWIN_FLOOR_HEIGHT + room.wallHeight * mesh.scale.y / 2;
      updateMaterial(mesh.material as MeshStandardMaterial, tints.current.wall, hovered ? .035 : 0);
    });
    if (transitioning) invalidate();
  });
  const labelPosition: [number, number, number] = [
    -Math.sign(room.x) * Math.min(0.45, room.width * 0.08),
    room.wallHeight + 0.7,
    -Math.sign(room.z) * Math.min(0.35, room.depth * 0.08),
  ];
  const select = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect({ kind: 'room', id: room.roomId }); };
  return <group position={[room.x, room.y, room.z]} onPointerOver={(event) => { event.stopPropagation(); setHovered(true); if (event.nativeEvent.target instanceof HTMLElement) event.nativeEvent.target.style.cursor = 'pointer'; }} onPointerOut={(event) => { setHovered(false); if (event.nativeEvent.target instanceof HTMLElement) event.nativeEvent.target.style.cursor = ''; }}>
    <mesh receiveShadow onClick={select} rotation={[-Math.PI / 2, 0, 0]} position={[0, TWIN_FLOOR_HEIGHT, 0]}>
      <shapeGeometry args={[floorShape]} />
      <meshStandardMaterial ref={floorMaterial} color={roomFloorColor(name, palette)} roughness={0.9} emissive={palette.primary} />
      <Edges color={selected || hovered ? palette.primaryHover : palette.line} threshold={20} />
    </mesh>
    <Twin3DRoomDecor room={room} name={name} palette={palette} compact={compact} shaped={room.customShape} onSelect={select} />
    {walls.map((wall, index) => <mesh key={wall.key} ref={(mesh) => { wallMeshes.current[index] = mesh; }} castShadow receiveShadow onClick={select} position={[wall.x, wallY, wall.z]} rotation={[0, wall.rotation, 0]}>
      <boxGeometry args={[wall.length, room.wallHeight, room.wallThickness]} />
      <meshStandardMaterial color={palette.wall} emissive={palette.primary} roughness={0.82} />
      <Edges color={selected ? palette.primaryHover : palette.line} threshold={25} />
    </mesh>)}
    {selected || hovered ? walls.map((wall) => <mesh key={`outline-${wall.key}`} position={[wall.x, TWIN_FLOOR_HEIGHT + .04, wall.z]} rotation={[0, wall.rotation, 0]}>
      <boxGeometry args={[wall.length, .065, selected ? .1 : .055]} />
      <meshBasicMaterial color={palette.primaryHover} />
    </mesh>) : null}
    {showLabel ? <Html center position={labelPosition} zIndexRange={[30, 10]}>
      <button type="button" aria-pressed={selected} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onSelect({ kind: 'room', id: room.roomId }); }} className={`twin-3d-room-label min-w-28 rounded-xl border bg-surface/95 px-3 py-2 text-left shadow-soft transition-opacity duration-200 ${selected ? 'border-primary ring-2 ring-primary/30' : 'border-line hover:border-primary'} ${dimmed ? 'opacity-80' : ''}`}>
        <strong className="block truncate text-xs text-text">{name}</strong>
        {!compact ? <span className="mt-0.5 block text-[10px] font-medium text-muted">{runtime ? `${runtime.deviceIds.length} thiết bị · ${runtime.sensorIds.length} cảm biến` : 'Không còn dữ liệu'}</span> : null}
      </button>
    </Html> : null}
  </group>;
});

function MarkerShell({ node, selected, healthStatus, label, detail, children, visual, updateSignature, onSelect }: {
  node: Twin3DNodeGeometry;
  selected: boolean;
  healthStatus: TwinHealthStatus;
  label: string;
  detail: string;
  palette: Twin3DPalette;
  children: React.ReactNode;
  visual?: React.ReactNode;
  updateSignature: string;
  onSelect: (selection: TwinLayoutSelection) => void;
}) {
  const selection = { kind: 'node', id: `${node.nodeType}:${node.nodeId}` } as const;
  const motionRef = useTwinUpdateMotion<HTMLButtonElement>(updateSignature);
  return <group position={[node.x, node.y, node.z]}>
    {visual ? <group position={[0, -TWIN_MARKER_ELEVATION + .55, 0]} scale={.6}>{visual}</group> : null}
    <Html center position={[0, .25, 0]} zIndexRange={[50, 31]}>
      <button ref={motionRef} type="button" aria-label={`${label}, ${detail}, ${healthStatus}`} aria-pressed={selected} data-world-x={node.x} data-world-y={node.y} data-world-z={node.z} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onSelect(selection); }} className={`twin-3d-marker group relative flex h-9 w-9 items-center justify-center rounded-xl border shadow-soft transition-transform duration-200 hover:scale-105 hover:ring-2 hover:ring-primary/40 ${healthMarkerStyles[healthStatus]} ${selected ? 'scale-110 ring-2 ring-primary' : ''}`}>
        {children}
        <span aria-hidden="true" className={`absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-surface text-[8px] font-bold text-text ${healthStatus === 'ACTIVE' ? 'bg-success' : healthStatus === 'STALE' ? 'bg-warning' : 'bg-off'}`}>{healthSymbols[healthStatus]}</span>
        <span aria-hidden="true" className={`pointer-events-none absolute bottom-12 left-1/2 w-40 -translate-x-1/2 rounded-xl border border-line bg-surface px-3 py-2 text-center shadow-float ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'} transition-opacity duration-200`}>
          <strong className="block truncate text-xs text-text">{label}</strong><small className="mt-0.5 block text-muted">{detail} · {healthStatus}</small>
        </span>
      </button>
    </Html>
  </group>;
}

const Twin3DDevice = memo(function Twin3DDevice({ node, selected, palette, onSelect }: { node: Twin3DNodeGeometry; selected: boolean; palette: Twin3DPalette; onSelect: (selection: TwinLayoutSelection) => void }) {
  const device = useAppSelector((state) => state.twin.devicesById[node.nodeId]);
  if (!device) return null;
  return <MarkerShell node={node} selected={selected} healthStatus={device.healthStatus} label={device.name} detail={`${powerSummary(device.currentState)} · ${device.status}`} updateSignature={JSON.stringify([device.currentState, device.healthStatus, device.lastSeen, device.status])} visual={<Twin3DDeviceVisual device={device} palette={palette} />} palette={palette} onSelect={onSelect}>
    <DeviceGlyph deviceType={device.deviceType} size={20} />
  </MarkerShell>;
});

const Twin3DSensor = memo(function Twin3DSensor({ node, selected, palette, onSelect }: { node: Twin3DNodeGeometry; selected: boolean; palette: Twin3DPalette; onSelect: (selection: TwinLayoutSelection) => void }) {
  const sensor = useAppSelector((state) => state.twin.sensorsById[node.nodeId]);
  if (!sensor) return null;
  const value = `${sensor.latestValue ?? '—'}${sensor.unit ? ` ${sensor.unit}` : ''}`;
  return <MarkerShell node={node} selected={selected} healthStatus={sensor.healthStatus} label={sensor.metricType} detail={value} updateSignature={JSON.stringify([sensor.latestValue, sensor.observedAt, sensor.healthStatus])} palette={palette} onSelect={onSelect}>
    <SensorGlyph metricType={sensor.metricType} size={20} />
  </MarkerShell>;
});

function Twin3DScene({ geometry, drafting, activeFloor, exploded, selection, fitRequest, cameraRequest, focusRoomId, compact, palette, onSelect, onCameraInteract }: {
  geometry: TwinLayoutGeometry;
  drafting: TwinDraftingMetadata;
  activeFloor: number | 'all';
  exploded: boolean;
  selection: TwinLayoutSelection | null;
  fitRequest: number;
  cameraRequest: TwinCameraRequest;
  focusRoomId: string | null;
  compact: boolean;
  palette: Twin3DPalette;
  onSelect: (selection: TwinLayoutSelection | null) => void;
  onCameraInteract: () => void;
}) {
  const deviceIds = useAppSelector((state) => state.twin.deviceIds);
  const reduced = useReducedMotion();
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
  // Subsequent floor/bounds changes belong to the camera controller, preserving the user's angle.
  const [initialCamera] = useState(() => ({
    target: [pose.target[0], maximumElevation / 2, pose.target[2]] as [number, number, number],
    position: [pose.position[0], pose.position[1] + maximumElevation * .72, pose.position[2]] as [number, number, number],
  }));
  return <>
    <color attach="background" args={[palette.infoSoft]} />
    <fog attach="fog" args={[palette.infoSoft, 28, 65]} />
    <PerspectiveCamera makeDefault fov={38} near={0.1} far={120} position={initialCamera.position} />
    <OrbitControls makeDefault target={initialCamera.target} enablePan={false} enableDamping={!reduced} dampingFactor={0.12} minDistance={4} maxDistance={pose.maxDistance + maximumElevation} minPolarAngle={CAMERA_MIN_POLAR} maxPolarAngle={CAMERA_MAX_POLAR} rotateSpeed={compact ? .85 : 1} zoomSpeed={.75} touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_ROTATE }} onStart={onCameraInteract} />
    <hemisphereLight args={[palette.surface, palette.metal, .65]} />
    <directionalLight castShadow={!compact} color={palette.surface} intensity={1.15} position={[-7, 14 + maximumElevation, 9]} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-camera-far={70} shadow-mapSize-width={compact ? 512 : 1024} shadow-mapSize-height={compact ? 512 : 1024} shadow-normalBias={.025} shadow-bias={-0.0004} shadow-radius={3} />
    <directionalLight color={palette.warningSoft} intensity={.3} position={[8, 7, -8]} />
    <ambientLight color={palette.infoSoft} intensity={0.22} />
    {activeFloor === 'all' || activeFloor === 1 ? <Twin3DLandscape bounds={bounds} palette={palette} compact={compact} /> : null}
    <Bounds maxDuration={reduced ? 0 : .45} margin={floorLevels.length > 1 ? (compact ? 1.24 : 1.3) : (compact ? 1.18 : 1.24)}>
      <FitCamera request={fitRequest} cameraRequest={cameraRequest} room={rooms.find((room) => room.roomId === focusRoomId)} />
      {rooms.map((room) => <Twin3DRoom key={room.roomId} room={room} selected={selection?.kind === 'room' && selection.id === room.roomId} dimmed={!!focusRoomId && room.roomId !== focusRoomId} compact={compact} showLabel={!multiFloorOverview || room.roomId === focusRoomId} palette={palette} onSelect={onSelect} />)}
      {nodes.map((node) => node.nodeType === 'DEVICE'
        ? <Twin3DDevice key={`${node.nodeType}:${node.nodeId}`} node={node} selected={selection?.kind === 'node' && selection.id === `${node.nodeType}:${node.nodeId}`} palette={palette} onSelect={onSelect} />
        : <Twin3DSensor key={`${node.nodeType}:${node.nodeId}`} node={node} selected={selection?.kind === 'node' && selection.id === `${node.nodeType}:${node.nodeId}`} palette={palette} onSelect={onSelect} />)}
    </Bounds>
    {!compact ? <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[bounds.centerX, -.17, bounds.centerZ]}>
      <planeGeometry args={[bounds.width + 6, bounds.depth + 6]} />
      <shadowMaterial transparent opacity={.18} />
    </mesh> : null}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[bounds.centerX, -0.2, bounds.centerZ]} onClick={(event) => { if (event.delta <= 3) { event.stopPropagation(); onSelect(null); } }}>
      <planeGeometry args={[Math.max(30, bounds.width + 8), Math.max(24, bounds.depth + 8)]} />
      <meshBasicMaterial color={palette.app} transparent opacity={0} depthWrite={false} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[bounds.centerX, -0.18, bounds.centerZ]} scale={[bounds.width / 2 + 2, bounds.depth / 2 + 1.8, 1]}>
      <circleGeometry args={[1, 48]} />
      <meshBasicMaterial color={palette.muted} transparent opacity={0.1} depthWrite={false} />
    </mesh>
  </>;
}

export const Twin3DCanvas = memo(function Twin3DCanvas({ geometry, drafting, activeFloor, exploded, selection, fitRequest, cameraRequest, focusRoomId, compact, palette, onSelect, onReady, onCameraInteract }: {
  geometry: TwinLayoutGeometry;
  drafting: TwinDraftingMetadata;
  activeFloor: number | 'all';
  exploded: boolean;
  selection: TwinLayoutSelection | null;
  fitRequest: number;
  cameraRequest: TwinCameraRequest;
  focusRoomId: string | null;
  compact: boolean;
  palette: Twin3DPalette;
  onSelect: (selection: TwinLayoutSelection | null) => void;
  onReady: () => void;
  onCameraInteract: () => void;
}) {
  return <Canvas aria-label="Mô hình nhà 3D" shadows={compact ? false : 'percentage'} frameloop="demand" dpr={[1, compact ? 1.2 : 1.5]} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} onCreated={onReady}>
    <Twin3DScene geometry={geometry} drafting={drafting} activeFloor={activeFloor} exploded={exploded} selection={selection} fitRequest={fitRequest} cameraRequest={cameraRequest} focusRoomId={focusRoomId} compact={compact} palette={palette} onSelect={onSelect} onCameraInteract={onCameraInteract} />
  </Canvas>;
});
