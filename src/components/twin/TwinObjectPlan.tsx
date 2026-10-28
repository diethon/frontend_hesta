import { useRef, useState, type PointerEvent } from 'react';
import { polygonCss, type TwinRoomDrafting, type TwinSceneObject } from './twinDrafting';
import type { TwinRoomLayout } from '../../types/twinLayout';
import { roomToWorld } from './twin3dGeometry';
import { positionSceneObject, sceneObjectLabels } from './twinObjectPlacement';

type ObjectDrag = {
  pointerId: number; startX: number; startY: number; pixelsWidth: number; pixelsDepth: number;
  origin: TwinSceneObject; preview: TwinSceneObject;
};

export function TwinObjectPlan({ room, metadata, editable = false, selected = false, gridStep, onSelectRoom, onChange }: {
  room: TwinRoomLayout; metadata: TwinRoomDrafting; editable?: boolean; selected?: boolean; gridStep?: number;
  onSelectRoom?: () => void; onChange?: (next: TwinRoomDrafting) => void;
}) {
  const world = roomToWorld(room);
  const drag = useRef<ObjectDrag | null>(null);
  const [preview, setPreview] = useState<TwinSceneObject | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const update = (object: TwinSceneObject) => onChange?.({ ...metadata, objects: metadata.objects?.map(item => item.id === object.id ? object : item) });
  const finish = (event: PointerEvent<HTMLButtonElement>, cancel = false) => {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    drag.current = null;
    setPreview(null);
    if (!cancel && (current.preview.x !== current.origin.x || current.preview.z !== current.origin.z)) {
      update(positionSceneObject(current.preview, current.preview.x, current.preview.z, metadata, world.width, world.depth, gridStep));
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <div className="pointer-events-none absolute inset-0 z-10" style={{ clipPath: polygonCss(metadata.points) }}>
    {metadata.objects?.map(original => {
      const object = preview?.id === original.id ? preview : original;
      const active = selected && selectedId === object.id;
      const label = sceneObjectLabels[object.kind];
      return <span key={object.id} data-scene-object={object.id} data-object-kind={object.kind} data-x={object.x} data-z={object.z}
        className="absolute" style={{ left: `${object.x / world.width * 100}%`, top: `${object.z / world.depth * 100}%`, width: `${object.width / world.width * 100}%`, height: `${object.depth / world.depth * 100}%`, transform: `translate(-50%, -50%) rotate(${-object.rotation}deg)` }}>
        <span aria-hidden="true" className={`absolute inset-0 border ${active ? 'border-primary bg-info-soft ring-2 ring-primary' : object.kind === 'WINDOW' ? 'border-primary bg-info-soft' : object.kind === 'DOOR' ? 'border-icon bg-surface' : 'border-icon bg-twin-fabric'}`} />
        {editable ? <button type="button" aria-label={`Di chuyển ${label.toLowerCase()}`} aria-pressed={active} title={`${label} · Kéo để di chuyển · Phím mũi tên để căn chỉnh`}
          className="pointer-events-auto absolute left-1/2 top-1/2 h-full min-h-11 w-full min-w-11 -translate-1/2 touch-none cursor-move rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
          onClick={(event) => { event.stopPropagation(); setSelectedId(object.id); onSelectRoom?.(); }}
          onPointerDown={(event) => {
            if (event.button !== 0 || drag.current) return;
            event.preventDefault(); event.stopPropagation(); event.currentTarget.focus();
            setSelectedId(object.id); onSelectRoom?.();
            const bounds = event.currentTarget.closest('[data-room-id]')?.getBoundingClientRect();
            if (!bounds || !bounds.width || !bounds.height) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, pixelsWidth: bounds.width, pixelsDepth: bounds.height, origin: object, preview: object };
          }}
          onPointerMove={(event) => {
            const current = drag.current;
            if (!current || event.pointerId !== current.pointerId) return;
            current.preview = positionSceneObject(current.origin,
              current.origin.x + (event.clientX - current.startX) / current.pixelsWidth * world.width,
              current.origin.z + (event.clientY - current.startY) / current.pixelsDepth * world.depth,
              metadata, world.width, world.depth);
            setPreview(current.preview);
          }}
          onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && drag.current) {
              const pointerId = drag.current.pointerId;
              drag.current = null; setPreview(null);
              if (event.currentTarget.hasPointerCapture(pointerId)) event.currentTarget.releasePointerCapture(pointerId);
              event.stopPropagation(); return;
            }
            const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
            if (!direction || drag.current) return;
            event.preventDefault(); event.stopPropagation();
            setSelectedId(object.id); onSelectRoom?.();
            const step = event.shiftKey ? .05 : gridStep ?? .1;
            update(positionSceneObject(object, object.x + direction[0] * step, object.z + direction[1] * step, metadata, world.width, world.depth, event.shiftKey ? undefined : gridStep));
          }}
        /> : null}
      </span>;
    })}
  </div>;
}
