export const CAMERA_MIN_POLAR = .06;
export const CAMERA_MAX_POLAR = Math.PI / 2 - .08;

export const cameraViews = [
  { id: 'isometric', label: 'Phối cảnh', theta: Math.atan2(.82, .92), phi: Math.atan2(Math.hypot(.82, .92), .98) },
  { id: 'top', label: 'Từ trên', theta: 0, phi: CAMERA_MIN_POLAR },
  { id: 'front', label: 'Mặt trước', theta: 0, phi: 1.08 },
  { id: 'right', label: 'Bên phải', theta: Math.PI / 2, phi: 1.08 },
  { id: 'back', label: 'Mặt sau', theta: Math.PI, phi: 1.08 },
  { id: 'left', label: 'Bên trái', theta: -Math.PI / 2, phi: 1.08 },
] as const;

export type TwinCameraView = typeof cameraViews[number]['id'];
export type TwinCameraAction = TwinCameraView | 'turn-left' | 'turn-right';
export type TwinCameraRequest = { serial: number; action: TwinCameraAction };

/** Shortest arc, including when crossing the -PI/PI boundary. */
export function cameraAngles(action: TwinCameraAction, theta: number, phi: number) {
  const preset = cameraViews.find((view) => view.id === action);
  const desired = preset?.theta ?? theta + (action === 'turn-left' ? -1 : 1) * Math.PI / 2;
  const difference = Math.atan2(Math.sin(desired - theta), Math.cos(desired - theta));
  return { theta: theta + difference, phi: Math.max(CAMERA_MIN_POLAR, Math.min(CAMERA_MAX_POLAR, preset?.phi ?? phi)) };
}

export function cameraTransitionProgress(elapsed: number, reducedMotion: boolean) {
  const t = reducedMotion ? 1 : Math.max(0, Math.min(1, elapsed / .5));
  return t * t * (3 - 2 * t);
}
