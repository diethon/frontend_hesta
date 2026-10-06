import { memo, useState, type ReactNode } from 'react';
import { Html } from '@react-three/drei';
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

interface MarkerProps {
  node: Twin3DNodeGeometry; selected: boolean; healthStatus: TwinHealthStatus; pending?: boolean; error?: boolean;
  label: string; detail: string; palette: Twin3DPalette; children: ReactNode; visual: ReactNode;
  placement: { x: number; y: number; z: number; rotation: number }; markerMode: TwinMarkerMode; houseOverview: boolean;
  onSelect: (selection: TwinLayoutSelection) => void; onFocus: (selection: TwinLayoutSelection) => void;
}
function MarkerShell({ node, selected, healthStatus, pending, error, label, detail, children, visual, placement, palette, markerMode, onSelect, onFocus }: MarkerProps) {
  const [hovered, setHovered] = useState(false);
  const selection = { kind: 'node', id: `${node.nodeType}:${node.nodeId}` } as const;
  const important = healthStatus !== 'ACTIVE' || !!pending || !!error;
  const visible = selected || hovered || (markerMode !== 'none' && (important || markerMode === 'all'));
  return <group name={`${node.nodeType}:${node.nodeId}`} position={[placement.x, placement.y, placement.z]}>
    <group rotation={[0, placement.rotation, 0]} onPointerOver={(event) => { event.stopPropagation(); setHovered(true); }} onPointerOut={() => setHovered(false)} onClick={(event) => { if (event.delta > 3) return; event.stopPropagation(); onSelect(selection); }} onDoubleClick={(event) => { event.stopPropagation(); onFocus(selection); }}>
      {visual}
      <mesh><sphereGeometry args={[.3, 8, 6]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
      {selected || hovered ? <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.08, 0]}><ringGeometry args={[.3, .32, 24]} /><meshBasicMaterial color={palette.primary} transparent opacity={selected ? .7 : .35} /></mesh> : null}
    </group>
    {visible ? <Html center position={[0, .35, 0]} zIndexRange={[40, 31]}>
      <button type="button" aria-label={`${label}, ${detail}, ${healthStatus}`} aria-pressed={selected} data-node-id={node.nodeId} data-world-x={node.x} data-world-y={placement.y} data-world-z={node.z} onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => { event.stopPropagation(); onFocus(selection); }} onClick={(event) => { event.stopPropagation(); onSelect(selection); }} className={`twin-3d-marker flex items-center gap-1 rounded-lg border bg-surface/95 p-1 text-xs shadow-soft ${selected ? 'border-primary text-primary-hover' : error ? 'border-error text-error' : healthStatus === 'STALE' ? 'border-warning text-warning' : healthStatus === 'OFFLINE' ? 'border-off text-muted' : 'border-line text-text'}`}>
        {children}{selected || hovered ? <span className="max-w-36 truncate text-[10px]">{label}</span> : null}
        {important ? <span aria-hidden="true" className="text-[9px] font-bold">{pending ? '…' : healthStatus === 'OFFLINE' ? '×' : '!'}</span> : null}
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
  const placement = opening ? { x: opening.start[0] + opening.axis[0] * opening.width / 2, y: 0, z: opening.start[1] + opening.axis[1] * opening.width / 2, rotation: 0 } : devicePlacement(node, room, device.deviceType, rotation);
  const localOpening = opening ? { ...opening, start: [opening.start[0] - placement.x, opening.start[1] - placement.z] as [number, number] } : undefined;
  return <MarkerShell node={node} selected={selected} pending={pending} error={!!error || device.status === 'ERROR'} healthStatus={device.healthStatus} label={device.name} detail={pending ? 'Đang chờ xác nhận…' : device.status} placement={placement} palette={palette} markerMode={markerMode} houseOverview={houseOverview} visual={<Twin3DDeviceVisual device={device} palette={palette} opening={localOpening} />} onSelect={onSelect} onFocus={onFocus}><DeviceGlyph deviceType={device.deviceType} size={15} /></MarkerShell>;
});
export const Twin3DSensor = memo(function Twin3DSensor({ node, selected, palette, markerMode, houseOverview, onSelect, onFocus }: {
  node: Twin3DNodeGeometry; selected: boolean; palette: Twin3DPalette; markerMode: TwinMarkerMode; houseOverview: boolean; onSelect: MarkerProps['onSelect']; onFocus: MarkerProps['onFocus'];
}) {
  const sensor = useAppSelector((state) => state.twin.sensorsById[node.nodeId]);
  if (!sensor) return null;
  return <MarkerShell node={node} selected={selected} healthStatus={sensor.healthStatus} label={sensor.metricType} detail={`${sensor.latestValue ?? '—'} ${sensor.unit ?? ''}`} placement={{ x: node.x, y: .14, z: node.z, rotation: 0 }} palette={palette} markerMode={markerMode} houseOverview={houseOverview} visual={<group><mesh castShadow><boxGeometry args={[.16, .08, .16]} /><meshStandardMaterial color={sensor.healthStatus === 'ACTIVE' ? palette.surface : palette.off} roughness={.8} /></mesh><mesh position={[0, .041, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.025, 12]} /><meshStandardMaterial color={sensor.healthStatus === 'ACTIVE' ? palette.success : palette.off} /></mesh></group>} onSelect={onSelect} onFocus={onFocus}><SensorGlyph metricType={sensor.metricType} size={14} /></MarkerShell>;
});
