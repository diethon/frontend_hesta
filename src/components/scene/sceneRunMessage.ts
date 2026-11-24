import type { SceneExecutionResponse, SceneResponse } from '../../types/scene';

/** What to tell the user after running a scene: which devices failed and why, not just "some errors". */
export function sceneRunMessage(
  scene: Pick<SceneResponse, 'name' | 'actions'>,
  run: Pick<SceneExecutionResponse, 'status' | 'resultDetail'>,
): { kind: 'success' | 'warning' | 'error'; text: string } {
  const rows = run.resultDetail ?? [];
  const failed = rows.filter((r) => !r.success);
  if (run.status === 'SUCCESS' || (rows.length > 0 && failed.length === 0)) {
    return { kind: 'success', text: `Đã chạy "${scene.name}"` };
  }
  const nameOf = (deviceId: string) =>
    scene.actions?.find((a) => a.targetDeviceId === deviceId)?.targetDeviceName || 'Một thiết bị';
  const names = [...new Set(failed.map((r) => nameOf(r.deviceId)))];
  const list = names.length > 2 ? `${names.slice(0, 2).join(', ')} và ${names.length - 2} thiết bị khác` : names.join(', ');
  const allOffline = failed.length > 0 && failed.every((r) => r.errorCode === 'DEVICE_OFFLINE');
  const reason = allOffline ? 'đang ngoại tuyến' : failed[0]?.message ? `lỗi: ${failed[0].message}` : 'không phản hồi';
  if (failed.length === 0) return { kind: 'error', text: `Không chạy được "${scene.name}"` };
  if (failed.length === rows.length) return { kind: 'error', text: `Không chạy được "${scene.name}": ${list} ${reason}` };
  return {
    kind: 'warning',
    text: `"${scene.name}" chạy được ${rows.length - failed.length}/${rows.length} thiết bị. ${list} ${reason}`,
  };
}
