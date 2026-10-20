import { memo, useMemo, useRef, useState, type ReactNode } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Layers3 } from 'lucide-react';
import { Group, Vector3 } from 'three';
import { useAppSelector } from '../../../store/hooks';
import type { TwinLayoutSelection } from '../../../types/twinLayout';
import type { Twin3DNodeGeometry, Twin3DShapedRoomGeometry } from '../twin3dGeometry';
import { knownPower } from '../twinPresentation';
import type { TwinMarkerMode } from './architectureMaterials';
import { MarkerClusterContext } from './MarkerClusterContext';
import { isMarkerCandidate, markerStatus, shouldClusterRoom } from './markerClustering';

interface Props {
  room: Twin3DShapedRoomGeometry;
  nodes: readonly Twin3DNodeGeometry[];
  selection: TwinLayoutSelection | null;
  markerMode: TwinMarkerMode;
  children: ReactNode;
  onFocus: (selection: TwinLayoutSelection) => void;
}

/** One inexpensive room selector; operational state never rebuilds the floor geometry. */
export const RoomMarkerCluster = memo(function RoomMarkerCluster({ room, nodes, selection, markerMode, children, onFocus }: Props) {
  const name = useAppSelector((state) => state.twin.roomsById[room.roomId]?.name ?? 'Phòng');
  const summary = useAppSelector((state) => {
    let count = 0, warning = false;
    for (const node of nodes) {
      const selected = selection?.kind === 'node' && selection.id === `${node.nodeType}:${node.nodeId}`;
      const device = node.nodeType === 'DEVICE' ? state.twin.devicesById[node.nodeId] : undefined;
      const sensor = node.nodeType === 'SENSOR' ? state.twin.sensorsById[node.nodeId] : undefined;
      if (!device && !sensor) continue;
      const command = device ? state.twinCommand.byId[node.nodeId] : undefined;
      const health = device?.status === 'OFFLINE' ? 'OFFLINE' : (device ?? sensor)!.healthStatus;
      const status = markerStatus(health, device ? knownPower(device.currentState) : null, !!command?.pending, !!command?.error || device?.status === 'ERROR');
      if (isMarkerCandidate(markerMode, status, selected)) {
        count++;
        warning ||= status === 'error' || status === 'warning' || status === 'offline';
      }
    }
    return `${count}:${warning ? 'warning' : 'online'}`;
  });
  const [count, status] = summary.split(':');
  const [distant, setDistant] = useState(false);
  const lastDistant = useRef(false), group = useRef<Group>(null);
  const worldCenter = useMemo(() => new Vector3(), []);
  const clustered = distant && Number(count) > 1;
  useFrame(({ camera, size, viewport }) => {
    if (!group.current || markerMode === 'none') return;
    group.current.getWorldPosition(worldCenter);
    const worldHeight = viewport.getCurrentViewport(camera, worldCenter).height;
    const pixels = Math.max(room.width, room.depth) * size.height / worldHeight;
    const next = shouldClusterRoom(pixels, lastDistant.current);
    if (next !== lastDistant.current) {
      lastDistant.current = next;
      setDistant(next);
    }
  });
  return <MarkerClusterContext.Provider value={clustered}>
    {children}
    <group ref={group} position={[room.x, .9, room.z]}>
      {clustered ? <Html center zIndexRange={[40, 31]}>
        <button type="button" className="twin-room-marker-cluster" data-twin-marker-cluster={room.roomId} data-status={status}
          aria-label={`${name}, ${count} thiết bị và cảm biến. Xem gần phòng`} title={`${name} · ${count} thiết bị và cảm biến · Nhấn để xem gần`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onFocus({ kind: 'room', id: room.roomId }); }}>
          <Layers3 size={16} aria-hidden="true" /><span>{count}</span>
        </button>
      </Html> : null}
    </group>
  </MarkerClusterContext.Provider>;
});
