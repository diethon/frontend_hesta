import type { TwinRoomDrafting } from './twinDrafting';
import type { TwinRoomLayout } from '../../types/twinLayout';
import { roomToWorld } from './twin3dGeometry';

export function TwinObjectPlan({ room, metadata }: { room: TwinRoomLayout; metadata: TwinRoomDrafting }) {
  const world = roomToWorld(room);
  return <span aria-hidden="true" className="pointer-events-none absolute inset-0">{metadata.objects?.map((object) => <span key={object.id} title={object.kind} className={`absolute border ${object.kind === 'WINDOW' ? 'border-primary bg-info-soft' : object.kind === 'DOOR' ? 'border-icon bg-surface' : 'border-icon bg-twin-fabric'}`} style={{ left: `${object.x / world.width * 100}%`, top: `${object.z / world.depth * 100}%`, width: `${object.width / world.width * 100}%`, height: `${object.depth / world.depth * 100}%`, transform: `translate(-50%, -50%) rotate(${-object.rotation}deg)` }} />)}</span>;
}
