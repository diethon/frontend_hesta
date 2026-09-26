import { useAppSelector } from '../../store/hooks';
import type { TwinLayoutGeometry, TwinLayoutSelection } from '../../types/twinLayout';
import { clampRoom, moveLayoutNode, nodeKey, resizeRoom } from './layoutGeometry';
import { TwinDeviceCard } from './TwinDeviceCard';
import { TwinSensorCard } from './TwinSensorCard';
import { TwinLayoutButton } from './TwinLayoutButton';
import { DeviceGlyph, RoomGlyph, SensorGlyph } from './TwinVisualIcon';
import { changeRoomDrafting, roomDrafting, type TwinDraftingMetadata, type TwinRoomDrafting } from './twinDrafting';
import type { TwinDraftingMode } from './TwinDraftingToolbar';

export function TwinLayoutInspector({ geometry, drafting, mode, selection, editable, onChange, onDraftingChange }: {
  geometry: TwinLayoutGeometry;
  drafting: TwinDraftingMetadata;
  mode: TwinDraftingMode;
  selection: TwinLayoutSelection | null;
  editable: boolean;
  onChange: (geometry: TwinLayoutGeometry) => void;
  onDraftingChange: (metadata: TwinDraftingMetadata) => void;
}) {
  const twin = useAppSelector((state) => state.twin);
  const roomsById = useAppSelector((state) => state.twin.roomsById);
  const room = selection?.kind === 'room' ? geometry.rooms.find((item) => item.roomId === selection.id) : undefined;
  const node = selection?.kind === 'node' ? geometry.nodes.find((item) => nodeKey(item) === selection.id) : undefined;
  if (!room && !node) return <section className="surface-card space-y-3 p-5"><h3 className="font-semibold">Đối tượng đang chọn</h3><p className="text-sm text-muted">Chọn một phòng hoặc đối tượng để xem chi tiết{editable ? ' và chỉnh vị trí bằng các ô phần trăm bên dưới' : ''}.</p></section>;
  const target = (room ?? node)!;
  const change = (field: 'x' | 'y' | 'width' | 'height', value: number) => {
    if (!Number.isFinite(value)) return;
    if (room) {
      const next = field === 'width' || field === 'height'
        ? resizeRoom(room, field === 'width' ? value : room.width, field === 'height' ? value : room.height)
        : clampRoom({ ...room, [field]: value });
      onChange({ ...geometry, rooms: geometry.rooms.map((item) => item.roomId === room.roomId ? next : item) });
    } else if (node) {
      const next = moveLayoutNode(node, field === 'x' ? value : node.x, field === 'y' ? value : node.y, geometry.rooms,
        (roomId) => roomDrafting(drafting, roomId).points);
      onChange({ ...geometry, nodes: geometry.nodes.map((item) => nodeKey(item) === nodeKey(node) ? next : item) });
    }
  };
  const fields = room ? ['x', 'y', 'width', 'height'] as const : ['x', 'y'] as const;
  const labels = { x: 'Ngang (%)', y: 'Dọc (%)', width: 'Rộng (%)', height: 'Cao (%)' };
  const roomName = room ? roomsById[room.roomId]?.name ?? 'Phòng' : '';
  const device = node?.nodeType === 'DEVICE' ? twin.devicesById[node.nodeId] : undefined;
  const sensor = node?.nodeType === 'SENSOR' ? twin.sensorsById[node.nodeId] : undefined;
  const roomMeta = room ? roomDrafting(drafting, room.roomId) : null;
  const changeMetric = (field: keyof Pick<TwinRoomDrafting, 'widthMeters' | 'depthMeters' | 'floorHeightMeters' | 'wallThicknessMeters'>, value: number) => {
    if (!room || !roomMeta) return;
    const next = { ...roomMeta };
    if (!Number.isFinite(value) || value <= 0) delete next[field];
    else next[field] = Math.round(value * 100) / 100;
    onDraftingChange(changeRoomDrafting(drafting, room.roomId, next));
  };
  return <section aria-label="Đối tượng đang chọn" className="surface-card space-y-4 p-4 sm:p-5">
    <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-info-soft">{room ? <RoomGlyph name={roomName} size={22} /> : device ? <DeviceGlyph deviceType={device.deviceType} size={22} /> : <SensorGlyph metricType={sensor?.metricType ?? ''} size={22} />}</span><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-muted">Đối tượng đang chọn</p><h3 className="truncate font-semibold text-text">{room ? roomName : device?.name ?? sensor?.metricType ?? 'Đối tượng'}</h3><p className="text-xs text-muted">{room ? 'Room' : node?.nodeType === 'DEVICE' ? device?.deviceType : 'Sensor'}</p></div></div>
    <label className="block text-sm text-muted">Tên<input readOnly value={room ? roomName : device?.name ?? sensor?.metricType ?? 'Đối tượng'} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-app px-3 text-text" /></label>
    {node ? <p className="text-sm text-muted">Phòng hiển thị: {node.roomId ? roomsById[node.roomId]?.name ?? 'Không còn trong dữ liệu' : 'Ngoài các phòng'}</p> : null}
    {roomMeta ? <div className="flex items-center justify-between gap-3 rounded-xl bg-info-soft px-3 py-2"><span className="text-xs font-semibold text-text">Hình phòng</span><span className="text-xs font-semibold text-primary-hover">{{ RECTANGLE: 'Chữ nhật', L_SHAPE: 'Chữ L', U_SHAPE: 'Chữ U', CUSTOM: 'Tự vẽ' }[roomMeta.shape]}</span></div> : null}
    {editable ? <>
      <div className="grid grid-cols-2 gap-3">{fields.map((field) => <label key={field} className="min-w-0 text-sm text-muted">
        {labels[field]}<input type="number" min={field === 'width' || field === 'height' ? 0.1 : 0} max={100} step={0.1}
          value={Math.round((field === 'width' || field === 'height' ? room![field] : target[field]) * 1000) / 10}
          onChange={(event) => change(field, event.currentTarget.valueAsNumber / 100)}
          className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-text" />
      </label>)}</div>
      {room && roomMeta && mode === 'precise' ? <fieldset className="space-y-3 rounded-xl border border-line bg-app p-3">
        <legend className="px-1 text-sm font-semibold text-text">Kích thước thực tế tùy chọn</legend>
        <p className="text-xs leading-5 text-muted">Dùng để ghi chú bản vẽ và điều chỉnh chiều cao 3D. Các giá trị này không được gửi vào Twin Layout API.</p>
        <div className="grid grid-cols-2 gap-3">
          {([
            ['widthMeters', 'Chiều rộng (m)', 0.1],
            ['depthMeters', 'Chiều sâu (m)', 0.1],
            ['floorHeightMeters', 'Chiều cao tầng (m)', 0.1],
            ['wallThicknessMeters', 'Độ dày tường (m)', 0.01],
          ] as const).map(([field, label, step]) => <label key={field} className="min-w-0 text-xs text-muted">{label}
            <input type="number" min={step} max={field === 'wallThicknessMeters' ? 1 : 30} step={step} value={roomMeta[field] ?? ''} placeholder={field === 'floorHeightMeters' ? '2.8' : field === 'wallThicknessMeters' ? '0.12' : '4.2'} onInput={(event) => changeMetric(field, event.currentTarget.valueAsNumber)} onBlur={(event) => changeMetric(field, event.currentTarget.valueAsNumber)} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25" />
          </label>)}
        </div>
      </fieldset> : null}
      <TwinLayoutButton variant="danger" onClick={() => onChange(room ? {
        rooms: geometry.rooms.filter((item) => item.roomId !== room.roomId),
        nodes: geometry.nodes.map((item) => item.roomId === room.roomId ? { ...item, roomId: null } : item),
      } : { ...geometry, nodes: geometry.nodes.filter((item) => nodeKey(item) !== nodeKey(node!)) })}>Bỏ vị trí khỏi sơ đồ</TwinLayoutButton>
      <p className="text-xs text-muted">Chỉ thay đổi vị trí hiển thị. Các phòng, thiết bị và cảm biến vẫn được giữ trong nhà.</p>
    </> : null}
    {node?.nodeType === 'DEVICE' ? <TwinDeviceCard deviceId={node.nodeId} /> : node ? <TwinSensorCard sensorId={node.nodeId} /> : null}
  </section>;
}
