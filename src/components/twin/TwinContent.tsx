import { useAppSelector } from '../../store/hooks';
import { selectTwinRoom } from '../../store/twinSelectors';
import { TwinDeviceCard } from './TwinDeviceCard';
import { TwinSensorCard } from './TwinSensorCard';

function NodeGroups({ deviceIds, sensorIds }: { deviceIds: string[]; sensorIds: string[] }) {
  return <div className="mt-5 grid gap-6 xl:grid-cols-2">
    <div className="min-w-0">
      <h3 className="mb-3 text-sm font-semibold text-muted">Thiết bị · {deviceIds.length}</h3>
      {deviceIds.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {deviceIds.map((deviceId) => <TwinDeviceCard key={deviceId} deviceId={deviceId} />)}
      </div> : <p className="rounded-xl bg-off-soft p-4 text-sm text-muted">Chưa có thiết bị trong khu vực này.</p>}
    </div>
    <div className="min-w-0">
      <h3 className="mb-3 text-sm font-semibold text-muted">Cảm biến · {sensorIds.length}</h3>
      {sensorIds.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {sensorIds.map((sensorId) => <TwinSensorCard key={sensorId} sensorId={sensorId} />)}
      </div> : <p className="rounded-xl bg-off-soft p-4 text-sm text-muted">Chưa có dữ liệu cảm biến trong khu vực này.</p>}
    </div>
  </div>;
}

function TwinRoomSection({ roomId }: { roomId: string }) {
  const room = useAppSelector((state) => selectTwinRoom(state, roomId));
  if (!room) return null;
  return <section aria-label={room.name} className="surface-card p-5 sm:p-6">
    <h2 className="break-words text-xl font-semibold">{room.name}</h2>
    <NodeGroups deviceIds={room.deviceIds} sensorIds={room.sensorIds} />
  </section>;
}

export function TwinContent() {
  const roomIds = useAppSelector((state) => state.twin.roomIds);
  const deviceIds = useAppSelector((state) => state.twin.unassignedDeviceIds);
  const sensorIds = useAppSelector((state) => state.twin.unassignedSensorIds);
  return <div className="space-y-6">
    {roomIds.length ? roomIds.map((roomId) => <TwinRoomSection key={roomId} roomId={roomId} />)
      : <section className="surface-card border-dashed p-8 text-center"><h2 className="font-semibold">Chưa có phòng</h2><p className="mt-2 text-sm text-muted">Hãy tạo phòng cho ngôi nhà trước khi thiết kế Digital Twin.</p></section>}
    <section aria-label="Chưa gán phòng" className="surface-card p-5 sm:p-6">
      <h2 className="text-xl font-semibold">Chưa gán phòng</h2>
      {deviceIds.length || sensorIds.length ? <NodeGroups deviceIds={deviceIds} sensorIds={sensorIds} />
        : <p className="mt-3 text-sm text-muted">Không có thiết bị hoặc cảm biến chưa gán phòng.</p>}
    </section>
  </div>;
}
