import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { useAppSelector } from '../../store/hooks';
import type { TwinHealthStatus } from '../../types/twin';
import type { TwinLayoutGeometry, TwinLayoutSelection, TwinNodeLayout, TwinRoomLayout } from '../../types/twinLayout';
import { clampRoom, moveLayoutNode, nodeKey, overlappingRoomIds, resizeRoom, snapPoint, snapRoom, type TwinSnapGuides } from './layoutGeometry';
import { DeviceGlyph, RoomGlyph, SensorGlyph } from './TwinVisualIcon';
import { RoomFurnishing } from './TwinRoomFurnishing';
import { roomKind } from './roomKind';
import { PALETTE_MIME, placePaletteItem, type PaletteItem } from './layoutPalette';
import { blueprintKey, changeRoomDrafting, polygonCss, roomDrafting, type TwinDraftingMetadata } from './twinDrafting';

type Interaction = { pointerId: number; startX: number; startY: number; width: number; height: number; selection: TwinLayoutSelection; resize: boolean; origin: TwinLayoutGeometry; preview: TwinLayoutGeometry; commit: TwinLayoutGeometry; guides: TwinSnapGuides };
type VertexInteraction = { pointerId: number; roomId: string; pointIndex: number; origin: TwinDraftingMetadata; preview: TwinDraftingMetadata };

const healthDotStyles: Record<TwinHealthStatus, string> = {
  ACTIVE: 'border-surface bg-success',
  STALE: 'border-surface bg-warning',
  OFFLINE: 'border-surface bg-off',
};

const healthLabels: Record<TwinHealthStatus, string> = {
  ACTIVE: 'Dữ liệu mới',
  STALE: 'Dữ liệu đã cũ',
  OFFLINE: 'Không có dữ liệu mới',
};

function tooltipPosition(node: TwinNodeLayout) {
  const vertical = node.y > 0.72 ? 'bottom-14' : 'top-14';
  const horizontal = node.x < 0.18 ? 'left-0' : node.x > 0.82 ? 'right-0' : 'left-1/2 -translate-x-1/2';
  return `${vertical} ${horizontal}`;
}

const markerPosition = (coordinate: number) => `clamp(1.5rem, ${coordinate * 100}%, calc(100% - 1.5rem))`;

export function TwinNodeSummary({ node }: { node: TwinNodeLayout }) {
  const device = useAppSelector((state) => node.nodeType === 'DEVICE' ? state.twin.devicesById[node.nodeId] : undefined);
  const sensor = useAppSelector((state) => node.nodeType === 'SENSOR' ? state.twin.sensorsById[node.nodeId] : undefined);
  if (!device && !sensor) return <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-off-soft text-xs font-semibold text-muted">?</span>;
  const power = device?.currentState && typeof device.currentState === 'object' && !Array.isArray(device.currentState) ? device.currentState.power : null;
  const healthStatus = (device ?? sensor)!.healthStatus;
  return <span className="relative flex h-10 w-10 items-center justify-center">
    {device ? <DeviceGlyph deviceType={device.deviceType} size={20} /> : <SensorGlyph metricType={sensor!.metricType} size={20} />}
    <span aria-hidden="true" className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 ${healthDotStyles[healthStatus]}`} />
    <span aria-hidden="true" className={`pointer-events-none absolute z-40 w-40 rounded-xl border border-line bg-surface px-3 py-2 text-center opacity-0 shadow-float transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${tooltipPosition(node)}`}>
      <span className="block truncate text-xs font-semibold text-text">{device?.name ?? sensor!.metricType}</span>
      <span className="mt-0.5 block text-xs font-medium text-muted">
        {device ? `${power === true ? 'ON' : power === false ? 'OFF' : typeof power === 'string' ? power : '—'} · ${device.status}` : `${sensor!.latestValue ?? '—'}${sensor!.unit ? ` ${sensor!.unit}` : ''}`}
      </span>
      <span className="mt-1 block text-[10px] font-semibold text-muted">{`${healthStatus} · ${healthLabels[healthStatus]}`}</span>
    </span>
  </span>;
}

export function TwinCanvas({ geometry, drafting, editable, selection, onSelect, onChange, onDraftingChange, zoom = 1, floor, overview = false }: {
  geometry: TwinLayoutGeometry; editable: boolean; selection: TwinLayoutSelection | null;
  drafting: TwinDraftingMetadata;
  zoom?: number;
  floor?: number;
  overview?: boolean;
  onSelect: (selection: TwinLayoutSelection) => void; onChange: (geometry: TwinLayoutGeometry) => void;
  onDraftingChange?: (metadata: TwinDraftingMetadata) => void;
}) {
  const roomsById = useAppSelector((state) => state.twin.roomsById);
  const devicesById = useAppSelector((state) => state.twin.devicesById);
  const sensorsById = useAppSelector((state) => state.twin.sensorsById);
  const canvas = useRef<HTMLDivElement>(null);
  const interaction = useRef<Interaction | null>(null);
  const vertexInteraction = useRef<VertexInteraction | null>(null);
  const [preview, setPreview] = useState<TwinLayoutGeometry | null>(null);
  const [draftingPreview, setDraftingPreview] = useState<TwinDraftingMetadata | null>(null);
  const [guides, setGuides] = useState<TwinSnapGuides>({ x: [], y: [] });
  const shown = preview ?? geometry;
  const shownDrafting = draftingPreview ?? drafting;
  const overlapIds = useMemo(() => overlappingRoomIds(shown.rooms), [shown.rooms]);
  const blueprint = shownDrafting.blueprints[blueprintKey(floor ?? shown.rooms[0]?.floor ?? 1)];
  const begin = (event: PointerEvent<HTMLButtonElement>, selected: TwinLayoutSelection, resize = false) => {
    if (event.button !== 0 || interaction.current) return;
    onSelect(selected);
    if (!editable || !canvas.current) return;
    event.preventDefault();
    event.currentTarget.focus();
    const bounds = canvas.current.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    interaction.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, width: bounds.width, height: bounds.height, selection: selected, resize, origin: geometry, preview: geometry, commit: geometry, guides: { x: [], y: [] } };
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = interaction.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = (event.clientX - drag.startX) / drag.width;
    const dy = (event.clientY - drag.startY) / drag.height;
    const next = { ...drag.origin };
    const commit = { ...drag.origin };
    if (drag.selection.kind === 'room') {
      next.rooms = drag.origin.rooms.map((room) => {
        if (room.roomId !== drag.selection.id) return room;
        const candidate = drag.resize ? resizeRoom(room, room.width + dx, room.height + dy) : clampRoom({ ...room, x: room.x + dx, y: room.y + dy });
        const snapped = snapRoom(candidate, drag.origin.rooms, { grid: drafting.settings.gridSnap, edges: drafting.settings.edgeSnap }, drag.resize);
        drag.guides = snapped.guides;
        return candidate;
      });
      commit.rooms = next.rooms.map((room) => room.roomId !== drag.selection.id ? room : snapRoom(room, drag.origin.rooms, { grid: drafting.settings.gridSnap, edges: drafting.settings.edgeSnap }, drag.resize).room);
    } else {
      next.nodes = drag.origin.nodes.map((node) => nodeKey(node) !== drag.selection.id ? node : moveLayoutNode(node,
        node.x + dx, node.y + dy, drag.origin.rooms,
        (roomId) => roomDrafting(drafting, roomId).points));
      commit.nodes = drag.origin.nodes.map((node) => nodeKey(node) !== drag.selection.id ? node : moveLayoutNode(node,
        snapPoint(node.x + dx, drafting.settings.gridSnap), snapPoint(node.y + dy, drafting.settings.gridSnap), drag.origin.rooms,
        (roomId) => roomDrafting(drafting, roomId).points));
    }
    drag.preview = next;
    drag.commit = commit;
    setPreview(next);
    setGuides(drag.guides);
  };
  const finish = (event: PointerEvent<HTMLButtonElement>, cancel = false) => {
    const drag = interaction.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    interaction.current = null;
    setPreview(null);
    setGuides({ x: [], y: [] });
    if (!cancel) onChange(drag.commit);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const beginVertex = (event: PointerEvent<HTMLButtonElement>, roomId: string, pointIndex: number) => {
    if (!editable || !onDraftingChange || event.button !== 0 || vertexInteraction.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    vertexInteraction.current = { pointerId: event.pointerId, roomId, pointIndex, origin: drafting, preview: drafting };
    setDraftingPreview(drafting);
  };
  const moveVertex = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = vertexInteraction.current;
    const roomElement = event.currentTarget.closest<HTMLElement>('[data-room-id]');
    if (!drag || event.pointerId !== drag.pointerId || !roomElement) return;
    const bounds = roomElement.getBoundingClientRect();
    const roomMeta = roomDrafting(drag.origin, drag.roomId);
    const grid = drafting.settings.gridSnap ? 40 : 1000;
    const point = {
      x: Math.max(0, Math.min(1, Math.round(((event.clientX - bounds.left) / bounds.width) * grid) / grid)),
      y: Math.max(0, Math.min(1, Math.round(((event.clientY - bounds.top) / bounds.height) * grid) / grid)),
    };
    const points = roomMeta.points.map((item, index) => index === drag.pointIndex ? point : item);
    drag.preview = changeRoomDrafting(drag.origin, drag.roomId, { ...roomMeta, points });
    setDraftingPreview(drag.preview);
  };
  const finishVertex = (event: PointerEvent<HTMLButtonElement>, cancel = false) => {
    const drag = vertexInteraction.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    vertexInteraction.current = null;
    setDraftingPreview(null);
    if (!cancel) onDraftingChange?.(drag.preview);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const handlers = { onPointerMove: move, onPointerUp: (event: PointerEvent<HTMLButtonElement>) => finish(event), onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => finish(event, true), onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => finish(event, true) };
  const roomStyle = ({ x, y, width, height }: TwinRoomLayout) => ({ left: `${x * 100}%`, top: `${y * 100}%`, width: `${width * 100}%`, height: `${height * 100}%` });
  return <div className={`twin-viewport overflow-auto rounded-xl border border-line bg-surface shadow-soft ${overview ? 'twin-2d-overview-viewport' : ''}`}><div ref={canvas} aria-label={overview ? 'Tổng quan mặt bằng tầng' : 'Sơ đồ nhà 2D'} style={{ width: `${zoom * 100}%`, height: `calc(var(--twin-canvas-height) * ${zoom})`, backgroundImage: drafting.settings.gridSnap ? undefined : 'none' }}
    onDragOver={(event) => { if (editable && event.dataTransfer.types.includes(PALETTE_MIME)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }}
    onDrop={(event) => {
      if (!editable || !canvas.current) return;
      event.preventDefault();
      let item: PaletteItem;
      try { item = JSON.parse(event.dataTransfer.getData(PALETTE_MIME)); } catch { return; }
      if (!item || typeof item.id !== 'string' || !(item.kind === 'room' ? roomsById[item.id] : item.kind === 'DEVICE' ? devicesById[item.id] : item.kind === 'SENSOR' ? sensorsById[item.id] : false)) return;
      const bounds = canvas.current.getBoundingClientRect();
      onChange(placePaletteItem(geometry, item, (event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height, floor,
        (roomId) => roomDrafting(drafting, roomId).points));
      onSelect({ kind: item.kind === 'room' ? 'room' : 'node', id: item.kind === 'room' ? item.id : `${item.kind}:${item.id}` });
  }} className="twin-canvas relative isolate overflow-hidden">
    {blueprint ? <img src={blueprint.dataUrl} alt="" aria-hidden="true" data-blueprint-underlay className="pointer-events-none absolute inset-0 h-full w-full object-fill" style={{ opacity: blueprint.opacity }} /> : null}
    {guides.x.map((coordinate) => <span key={`x-${coordinate}`} aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-30 w-px bg-primary" style={{ left: `${coordinate * 100}%` }} />)}
    {guides.y.map((coordinate) => <span key={`y-${coordinate}`} aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-30 h-px bg-primary" style={{ top: `${coordinate * 100}%` }} />)}
    <span aria-hidden="true" className="pointer-events-none absolute right-3 top-3 z-20 flex h-11 w-11 flex-col items-center justify-center rounded-full border border-line bg-surface text-xs text-primary-hover shadow-soft">N<span className="text-lg leading-none">▲</span></span>
    {overlapIds.size ? <span role="status" className="absolute left-3 top-3 z-30 rounded-xl border border-error bg-error-soft px-3 py-2 text-xs font-semibold text-text shadow-soft">{overlapIds.size} phòng đang chồng lấn</span> : null}
    {shown.rooms.map((room) => {
      const selected = selection?.kind === 'room' && selection.id === room.roomId;
      const name = roomsById[room.roomId]?.name ?? 'Phòng không còn trong dữ liệu';
      const roomTint = { living: 'bg-warning-soft', bedroom: 'bg-info-soft', kitchen: 'bg-success-soft', bathroom: 'bg-error-soft', other: 'bg-info-soft' }[roomKind(name)];
      const roomMeta = roomDrafting(shownDrafting, room.roomId);
      const polygon = polygonCss(roomMeta.points);
      const polygonPoints = roomMeta.points.map((point) => `${point.x * 100},${point.y * 100}`).join(' ');
      const overlapping = overlapIds.has(room.roomId);
      return <div key={room.roomId} data-room-id={room.roomId} data-room-shape={roomMeta.shape} style={roomStyle(room)} className={`twin-room absolute ${overlapping ? 'text-error' : selected ? 'text-primary-hover' : 'text-icon'}`}>
        <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible drop-shadow-sm"><polygon points={polygonPoints} fill="none" stroke="currentColor" strokeWidth="4" vectorEffect="non-scaling-stroke" /></svg>
        <button type="button" aria-pressed={selected} aria-label={`Chọn phòng ${roomsById[room.roomId]?.name ?? room.roomId}`} onClick={() => onSelect({ kind: 'room', id: room.roomId })}
          onPointerDown={(event) => begin(event, { kind: 'room', id: room.roomId })} {...handlers}
          style={{ clipPath: polygon }} className={`relative h-full w-full overflow-hidden p-3 text-left align-top text-sm font-semibold shadow-soft ${roomTint} ${selected ? 'ring-2 ring-primary ring-inset' : ''} ${editable ? 'touch-none cursor-move' : ''}`}>
          <RoomFurnishing name={name} />
          <span className="absolute inset-x-3 top-3 flex items-center gap-2"><RoomGlyph name={name} size={18} /><span className="min-w-0 truncate text-sm text-text sm:text-base">{name}</span></span>
          <span className="absolute left-3 top-14 text-xs font-medium text-muted">{Math.round(room.width * room.height * 1000) / 10}% mặt bằng</span>
          {roomMeta.widthMeters || roomMeta.depthMeters ? <span className="absolute bottom-3 left-3 rounded-lg bg-surface/90 px-2 py-1 text-[10px] font-semibold text-text">{roomMeta.widthMeters ? `${roomMeta.widthMeters} m` : 'Chưa đo rộng'} × {roomMeta.depthMeters ? `${roomMeta.depthMeters} m` : 'chưa đo sâu'}</span> : null}
        </button>
        {editable && selected ? roomMeta.points.map((point, pointIndex) => <button key={`${room.roomId}-${pointIndex}`} type="button" aria-label={`Kéo đỉnh ${pointIndex + 1} của ${name}`} onPointerDown={(event) => beginVertex(event, room.roomId, pointIndex)} onPointerMove={moveVertex} onPointerUp={(event) => finishVertex(event)} onPointerCancel={(event) => finishVertex(event, true)} onLostPointerCapture={(event) => finishVertex(event, true)} className="absolute z-30 h-6 w-6 touch-none rounded-full border-2 border-surface bg-primary shadow-soft focus-visible:ring-2 focus-visible:ring-primary" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%`, transform: 'translate(-50%, -50%)' }} />) : null}
        {editable ? <button type="button" aria-label={`Đổi kích thước ${roomsById[room.roomId]?.name ?? room.roomId}`}
          onClick={() => onSelect({ kind: 'room', id: room.roomId })} onPointerDown={(event) => begin(event, { kind: 'room', id: room.roomId }, true)} {...handlers}
          className="absolute -bottom-2 -right-2 z-20 flex h-11 w-11 touch-none cursor-se-resize items-end justify-end text-text"><span className="flex h-5 w-5 items-center justify-center border border-icon bg-surface text-xs">↘</span></button> : null}
      </div>;
    })}
    {shown.nodes.map((node) => {
      const device = node.nodeType === 'DEVICE' ? devicesById[node.nodeId] : undefined;
      const sensor = node.nodeType === 'SENSOR' ? sensorsById[node.nodeId] : undefined;
      const label = device
        ? `${device.name}, ${device.status}, ${device.healthStatus}`
        : sensor ? `${sensor.metricType}, ${sensor.latestValue ?? 'chưa có dữ liệu'}${sensor.unit ? ` ${sensor.unit}` : ''}, ${sensor.healthStatus}` : 'Đối tượng không còn trong dữ liệu';
      return <button type="button" key={nodeKey(node)} data-node-key={nodeKey(node)} data-x={node.x} data-y={node.y}
      aria-label={`Chọn ${node.nodeType === 'DEVICE' ? 'thiết bị' : 'cảm biến'} ${label}`}
      aria-pressed={selection?.kind === 'node' && selection.id === nodeKey(node)}
      style={{ left: markerPosition(node.x), top: markerPosition(node.y), transform: 'translate(-50%, -50%)' }}
      onClick={() => onSelect({ kind: 'node', id: nodeKey(node) })}
      onPointerDown={(event) => begin(event, { kind: 'node', id: nodeKey(node) })} {...handlers}
      className={`twin-canvas-node group absolute z-10 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface shadow-soft hover:z-30 focus-visible:z-30 ${editable ? 'touch-none cursor-move' : ''} ${selection?.kind === 'node' && selection.id === nodeKey(node) ? 'ring-2 ring-primary' : ''}`}>
      <TwinNodeSummary node={node} />
    </button>;
    })}
    {!shown.rooms.length && !shown.nodes.length ? <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center"><div><p className="text-lg font-semibold">Chưa có sơ đồ</p><p className="mt-2 text-sm text-muted">Chủ nhà có thể đặt phòng, thiết bị và cảm biến từ bảng bên dưới.</p></div></div> : null}
  </div></div>;
}
