import { memo, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Html, useCursor } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { CircleAlert, LoaderCircle, WifiOff } from 'lucide-react';
import type { Mesh, MeshBasicMaterial } from 'three';
import { useAppSelector } from '../../../store/hooks';
import type { TwinHealthStatus } from '../../../types/twin';
import type { TwinLayoutSelection } from '../../../types/twinLayout';
import { DeviceGlyph, SensorGlyph } from '../TwinVisualIcon';
import type { Twin3DNodeGeometry, Twin3DShapedRoomGeometry } from '../twin3dGeometry';
import type { Twin3DPalette } from '../twin3dPalette';
import { Twin3DDeviceVisual } from '../Twin3DDeviceVisual';
import type { TwinMarkerMode } from './architectureMaterials';
import { devicePlacement } from './devicePlacement';
import type { OpeningInfo } from '../neonplan/viewer/build';
import { knownPower } from '../twinPresentation';
import { useReducedMotion } from '../useTwinMotion';
import { MarkerClusterContext } from './MarkerClusterContext';
import { isFreshMotionEvent, isImportantMarker, markerStatus } from './markerClustering';
import './markers.css';

interface MarkerProps {
  node: Twin3DNodeGeometry; selected: boolean; healthStatus: TwinHealthStatus; pending?: boolean; error?: boolean;
  powered?: boolean | null;
  label: string; detail: string; palette: Twin3DPalette; children: ReactNode; visual: ReactNode;
  placement: { x: number; y: number; z: number; rotation: number }; markerMode: TwinMarkerMode; houseOverview: boolean;
  onSelect: (selection: TwinLayoutSelection) => void; onFocus: (selection: TwinLayoutSelection) => void;
}
function MarkerShell({ node, selected, healthStatus, pending, error, powered = null, label, detail, children, visual, placement, palette, markerMode, onSelect, onFocus }: MarkerProps) {
  const [hovered, setHovered] = useState(false);
  const clustered = useContext(MarkerClusterContext);
  useCursor(hovered);
  const selection = { kind: 'node', id: `${node.nodeType}:${node.nodeId}` } as const;
  const status = markerStatus(healthStatus, powered, pending, error);
  const important = isImportantMarker(status);
  const visible = selected || hovered || (!clustered && markerMode !== 'none' && (important || markerMode === 'all'));
  const statusLabel = { on: 'Đang bật', off: 'Đang tắt', online: 'Trực tuyến', offline: 'Ngoại tuyến', warning: 'Dữ liệu trễ', error: 'Có lỗi', pending: 'Đang chờ xác nhận' }[status];
  return <group name={`${node.nodeType}:${node.nodeId}`} position={[placement.x, placement.y, placement.z]}>
    <group rotation={[0, placement.rotation, 0]} onPointerOver={(event) => { event.stopPropagation(); setHovered(true); }} onPointerOut={() => setHovered(false)} onClick={(event) => { if (event.delta > 3) return; event.stopPropagation(); onSelect(selection); }} onDoubleClick={(event) => { event.stopPropagation(); onFocus(selection); }}>
      {visual}
      <mesh><sphereGeometry args={[.3, 8, 6]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
      {selected || hovered ? <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.08, 0]}><ringGeometry args={[.3, .32, 24]} /><meshBasicMaterial color={palette.primary} transparent opacity={selected ? .7 : .35} /></mesh> : null}
    </group>
    {visible ? <Html center position={[0, .35, 0]} zIndexRange={[40, 31]}>
      <button type="button" aria-label={`${label}, ${detail}, ${healthStatus}`} aria-pressed={selected} title={`${label} · ${statusLabel} · ${detail}`} data-status={status} data-node-id={node.nodeId} data-world-x={node.x} data-world-y={placement.y} data-world-z={node.z} onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => { event.stopPropagation(); onFocus(selection); }} onClick={(event) => { event.stopPropagation(); onSelect(selection); }} className="twin-3d-marker twin-smart-marker">
        {children}
        <span className="twin-smart-marker-tooltip" aria-hidden="true"><strong>{label}</strong><span>{statusLabel}{detail && detail !== statusLabel ? ` · ${detail}` : ''}</span></span>
        {important ? <span className="twin-smart-marker-status" aria-hidden="true">{pending ? <LoaderCircle size={10} /> : healthStatus === 'OFFLINE' ? <WifiOff size={10} /> : <CircleAlert size={10} />}</span> : null}
      </button>
    </Html> : null}
  </group>;
}
export const Twin3DDevice = memo(function Twin3DDevice({ node, room, opening, rotation, selected, palette, markerMode, houseOverview, onSelect, onFocus }: {
  node: Twin3DNodeGeometry; room?: Twin3DShapedRoomGeometry; opening?: OpeningInfo; rotation: number; selected: boolean; palette: Twin3DPalette;
  markerMode: TwinMarkerMode; houseOverview: boolean; onSelect: MarkerProps['onSelect']; onFocus: MarkerProps['onFocus'];
}) {
  const pending = useAppSelector((state) => state.twinCommand.byId[node.nodeId]?.pending), device = useAppSelector((state) => state.twin.devicesById[node.nodeId]);
  const error = useAppSelector((state) => state.twinCommand.byId[node.nodeId]?.error);
  if (!device) return null;
  const placement = opening ? { x: opening.start[0] + opening.axis[0] * opening.width / 2, y: 0, z: opening.start[1] + opening.axis[1] * opening.width / 2, rotation: 0 } : devicePlacement(node, room, device.deviceType, rotation, device.name);
  const localOpening = opening ? { ...opening, start: [opening.start[0] - placement.x, opening.start[1] - placement.z] as [number, number] } : undefined;
  return <MarkerShell node={node} selected={selected} pending={pending} error={!!error || device.status === 'ERROR'} powered={knownPower(device.currentState)} healthStatus={device.status === 'OFFLINE' ? 'OFFLINE' : device.healthStatus} label={device.name} detail={pending ? 'Đang chờ xác nhận…' : device.status} placement={placement} palette={palette} markerMode={markerMode} houseOverview={houseOverview} visual={<Twin3DDeviceVisual device={device} palette={palette} opening={localOpening} />} onSelect={onSelect} onFocus={onFocus}><DeviceGlyph deviceType={device.deviceType} size={17} /></MarkerShell>;
});

function MotionPulse({ metric, value, observedAt, color }: { metric: string; value: number | null; observedAt: string | null; color: string }) {
  const previous = useRef(observedAt), started = useRef<number | null>(null), ring = useRef<Mesh>(null);
  const reduced = useReducedMotion(), invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (!reduced && isFreshMotionEvent(metric, value, observedAt, previous.current, Date.now())) {
      started.current = performance.now();
      invalidate();
    }
    previous.current = observedAt;
  }, [metric, value, observedAt, reduced, invalidate]);
  useFrame(() => {
    if (!ring.current) return;
    const progress = started.current === null ? 1 : Math.min(1, (performance.now() - started.current) / 1200);
    ring.current.visible = !reduced && progress < 1;
    if (!ring.current.visible) return;
    ring.current.scale.setScalar(.3 + progress * 1.8);
    (ring.current.material as MeshBasicMaterial).opacity = (1 - progress) * .5;
    invalidate();
  });
  return <mesh ref={ring} visible={false} rotation={[-Math.PI / 2, 0, 0]} position={[0, -.08, 0]} raycast={() => undefined}><ringGeometry args={[.2, .24, 32]} /><meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} /></mesh>;
}
export const Twin3DSensor = memo(function Twin3DSensor({ node, selected, palette, markerMode, houseOverview, onSelect, onFocus }: {
  node: Twin3DNodeGeometry; selected: boolean; palette: Twin3DPalette; markerMode: TwinMarkerMode; houseOverview: boolean; onSelect: MarkerProps['onSelect']; onFocus: MarkerProps['onFocus'];
}) {
  const sensor = useAppSelector((state) => state.twin.sensorsById[node.nodeId]);
  if (!sensor) return null;
  return <MarkerShell node={node} selected={selected} healthStatus={sensor.healthStatus} label={sensor.metricType} detail={`${sensor.latestValue ?? '—'} ${sensor.unit ?? ''}`} placement={{ x: node.x, y: .14, z: node.z, rotation: 0 }} palette={palette} markerMode={markerMode} houseOverview={houseOverview} visual={<group><mesh castShadow><boxGeometry args={[.16, .08, .16]} /><meshStandardMaterial color={sensor.healthStatus === 'ACTIVE' ? palette.surface : palette.off} roughness={.8} /></mesh><mesh position={[0, .041, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.025, 12]} /><meshStandardMaterial color={sensor.healthStatus === 'ACTIVE' ? palette.success : palette.off} /></mesh><MotionPulse metric={sensor.metricType} value={sensor.healthStatus === 'ACTIVE' ? sensor.latestValue : null} observedAt={sensor.observedAt} color={palette.success} /></group>} onSelect={onSelect} onFocus={onFocus}><SensorGlyph metricType={sensor.metricType} size={17} /></MarkerShell>;
});
