import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Html, Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { shallowEqual } from 'react-redux';
import { Color, DoubleSide, Shape, Vector3 } from 'three';
import { useAppSelector } from '../../../store/hooks';
import { roomHeatmapReading } from '../../../services/twinAdapter';
import type { TwinHeatmapMode } from '../../../types/twinView';
import type { TwinLayoutSelection } from '../../../types/twinLayout';
import type { Twin3DPalette } from '../twin3dPalette';
import { centroid, pointInPolygon, type Room } from '../neonplan/model';
import { heatColor } from '../neonplan/heatmap';

/** Only this room's sensor selector changes its surface; topology remains untouched. */
export const RoomScene = memo(function RoomScene({ room, selected, showLabel, palette, heatmapMode, onSelect, onFocus }: {
  room: Room; selected: boolean; showLabel: boolean; palette: Twin3DPalette; heatmapMode: TwinHeatmapMode;
  onSelect: (selection: TwinLayoutSelection) => void; onFocus: (selection: TwinLayoutSelection) => void;
}) {
  const [hovered, setHovered] = useState(false), label = useRef<HTMLButtonElement>(null);
  const invalidate = useThree((state) => state.invalidate);
  const reading = useAppSelector((state) => heatmapMode === 'normal' ? null : roomHeatmapReading(
    (state.twin.roomsById[room.id]?.sensorIds ?? []).flatMap((id) => state.twin.sensorsById[id] ? [state.twin.sensorsById[id]] : []), heatmapMode), shallowEqual);
  const sensors = useAppSelector((state) => hovered || selected ? (state.twin.roomsById[room.id]?.sensorIds ?? []).map((id) => state.twin.sensorsById[id]).filter(Boolean) : null, shallowEqual);
  const shape = useMemo(() => { const result = new Shape(); room.points.forEach(([x, z], i) => { if (i === 0) result.moveTo(x, -z); else result.lineTo(x, -z); }); result.closePath(); return result; }, [room.points]);
  const center = useMemo(() => { const p = centroid(room.points); return pointInPolygon(p, room.points) ? p : room.points.length ? [(room.points[0][0] + room.points[1][0]) / 2, (room.points[0][1] + room.points[1][1]) / 2] : [0, 0]; }, [room.points]);
  const color = reading && heatmapMode !== 'normal' ? heatmapMode === 'air-quality' ? new Color(palette.success).lerp(new Color(palette.heatHigh), reading.ratio) : new Color(...heatColor(heatmapMode, reading.value)) : new Color(palette.primary);
  const projection = useMemo(() => new Vector3(), []);
  useEffect(() => invalidate(), [reading, selected, hovered, invalidate]);
  useFrame(({ camera, size }) => {
    if (!label.current) return;
    const radius = Math.max(...room.points.map(([x, z]) => Math.hypot(x - center[0], z - center[1])), 1);
    projection.set(center[0], .05, center[1]);
    label.current.style.visibility = showLabel && radius * size.height / camera.position.distanceTo(projection) > 65 ? 'visible' : 'hidden';
  });
  const selection = { kind: 'room', id: room.id } as const;
  return <group name={`room:${room.id}`}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .006, 0]} onClick={(event) => { if (event.delta > 3) return; event.stopPropagation(); onSelect(selection); }} onDoubleClick={(event) => { event.stopPropagation(); onFocus(selection); }} onPointerOver={(event) => { event.stopPropagation(); setHovered(true); }} onPointerOut={() => setHovered(false)}>
      <shapeGeometry args={[shape]} /><meshBasicMaterial side={DoubleSide} color={color} transparent opacity={reading ? .78 : selected ? .07 : hovered ? .035 : 0} depthWrite={false} />
    </mesh>
    {hovered || selected ? <Line points={[...room.points, room.points[0]].map(([x, z]) => [x, .016, z])} color={palette.primary} opacity={selected ? .4 : .25} transparent lineWidth={1} raycast={() => undefined} /> : null}
    {showLabel ? <Html position={[center[0], .04, center[1]]} center zIndexRange={[20, 11]}><button ref={label} type="button" data-twin-room-id={room.id} style={{ color: palette.text }} className="twin-3d-room-label whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide text-text/80" onClick={() => onSelect(selection)} onDoubleClick={() => onFocus(selection)}>{room.name}{reading ? <span className="ml-1 font-normal">{reading.value}{reading.unit}</span> : null}</button></Html> : null}
    {hovered && sensors?.length ? <Html position={[center[0], .15, center[1]]} center zIndexRange={[30, 21]} style={{ pointerEvents: 'none' }}><div className="rounded-xl border border-line bg-surface/95 p-2 text-xs text-text shadow-soft"><strong>{room.name}</strong>{sensors.slice(0, 3).map((sensor) => <p key={sensor.sensorId} className="mt-1 text-muted">{sensor.metricType} · {sensor.latestValue ?? '—'} {sensor.unit}</p>)}</div></Html> : null}
  </group>;
});
