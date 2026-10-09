import { useEffect, useMemo, useRef } from 'react';
import { Box3, Vector3, Spherical, PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useFrame, useThree } from '@react-three/fiber';
import type { Twin3DShapedRoomGeometry, Twin3DNodeGeometry } from '../twin3dGeometry';
import { useReducedMotion } from '../useTwinMotion';
import { CAMERA_MIN_POLAR, CAMERA_MAX_POLAR, cameraAngles, cameraTransitionProgress, type TwinCameraRequest } from '../twin3dCamera';
import { fitDistance, roomBounds } from './cameraFraming';

export function FitCamera({ request, cameraRequest, rooms, room, node }: { request: number; cameraRequest: TwinCameraRequest; rooms: readonly Twin3DShapedRoomGeometry[]; room?: Twin3DShapedRoomGeometry; node?: Twin3DNodeGeometry }) {
  const invalidate = useThree((state) => state.invalidate), size = useThree((state) => state.size), camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null;
  const get = useThree((state) => state.get);
  const reduced = useReducedMotion(), previousCommand = useRef<TwinCameraRequest | null>(null);
  const orbit = useMemo(() => new Spherical(), []), offset = useMemo(() => new Vector3(), []);
  const animation = useRef<{ startedAt: number | null; start: Spherical; end: Spherical; from: Vector3; to: Vector3 } | null>(null);
  useEffect(() => { if (!controls) return; const interrupt = () => { animation.current = null; }; controls.addEventListener('start', interrupt); return () => controls.removeEventListener('start', interrupt); }, [controls]);
  useEffect(() => {
    if (!controls || !(camera instanceof PerspectiveCamera) || !rooms.length) return;
    const command = previousCommand.current !== cameraRequest ? cameraRequest.action : null;
    previousCommand.current = cameraRequest;
    const model = node ? get().scene.getObjectByName(`${node.nodeType}:${node.nodeId}`) : undefined;
    model?.updateWorldMatrix(true, true);
    const box = model ? new Box3().setFromObject(model).expandByScalar(.9) : node ? new Box3(new Vector3(node.x - 1.2, node.y - .8, node.z - 1.2), new Vector3(node.x + 1.2, node.y + .8, node.z + 1.2)) : roomBounds(room ? [room] : rooms);
    const center = box.getCenter(new Vector3());
    center.y = box.min.y + (box.max.y - box.min.y) * (room || node ? .4 : .45);
    const start = new Spherical().setFromVector3(camera.position.clone().sub(controls.target)), end = start.clone();
    const zooming = command === 'zoom-in' || command === 'zoom-out', turning = command === 'turn-left' || command === 'turn-right';
    if (command && !zooming) Object.assign(end, cameraAngles(command, start.theta, start.phi));
    end.phi = Math.max(CAMERA_MIN_POLAR, Math.min(CAMERA_MAX_POLAR, end.phi));
    const distance = fitDistance(box, center, end.theta, end.phi, camera.fov, size.width / Math.max(1, size.height));
    const control = get().controls as OrbitControlsImpl;
    control.maxDistance = Math.max(24, distance * 3);
    end.radius = zooming ? Math.max(control.minDistance, Math.min(control.maxDistance, start.radius * (command === 'zoom-in' ? .8 : 1.25))) : turning ? start.radius : distance;
    animation.current = { startedAt: null, start, end, from: controls.target.clone(), to: turning || zooming ? controls.target.clone() : center };
    invalidate();
  }, [rooms, room, node, request, cameraRequest, size, camera, controls, get, invalidate]);
  useFrame(() => {
    const move = animation.current;
    if (!move || !controls) return;
    move.startedAt ??= performance.now();
    const t = cameraTransitionProgress((performance.now() - move.startedAt) / 1000, reduced);
    orbit.set(move.start.radius + (move.end.radius - move.start.radius) * t, move.start.phi + (move.end.phi - move.start.phi) * t, move.start.theta + (move.end.theta - move.start.theta) * t);
    controls.target.lerpVectors(move.from, move.to, t);
    camera.position.copy(controls.target).add(offset.setFromSpherical(orbit));
    controls.update();
    if (t === 1) animation.current = null; else invalidate();
  });
  return null;
}
