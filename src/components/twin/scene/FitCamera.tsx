import { useEffect, useMemo, useRef } from 'react';
import { Box3, Vector3, Spherical, PerspectiveCamera, OrthographicCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useFrame, useThree } from '@react-three/fiber';
import type { Twin3DShapedRoomGeometry, Twin3DNodeGeometry } from '../twin3dGeometry';
import { useReducedMotion } from '../useTwinMotion';
import { CAMERA_MIN_POLAR, CAMERA_MAX_POLAR, cameraAngles, cameraTransitionProgress, type TwinCameraRequest } from '../twin3dCamera';
import { DEVICE_FOCUS_MIN_DISTANCE, fitDistance, fitOrthographicZoom, nodeFocusAngles, nodeFocusBounds, roomBounds } from './cameraFraming';

export function FitCamera({ request, cameraRequest, rooms, room, node }: { request: number; cameraRequest: TwinCameraRequest; rooms: readonly Twin3DShapedRoomGeometry[]; room?: Twin3DShapedRoomGeometry; node?: Twin3DNodeGeometry }) {
  const invalidate = useThree((state) => state.invalidate), size = useThree((state) => state.size), activeCamera = useThree((state) => state.camera);
  const activeControls = useThree((state) => state.controls);
  const get = useThree((state) => state.get);
  const reduced = useReducedMotion(), previousCommand = useRef<TwinCameraRequest | null>(null);
  const orbit = useMemo(() => new Spherical(), []), offset = useMemo(() => new Vector3(), []);
  const animation = useRef<{ startedAt: number | null; start: Spherical; end: Spherical; from: Vector3; to: Vector3; fromZoom: number; toZoom: number } | null>(null);
  useEffect(() => { const controls = get().controls as OrbitControlsImpl | null; if (!controls) return; const interrupt = () => { animation.current = null; }; controls.addEventListener('start', interrupt); return () => controls.removeEventListener('start', interrupt); }, [activeControls, get]);
  useEffect(() => {
    const camera = get().camera, controls = get().controls as OrbitControlsImpl | null;
    if (!controls || !(camera instanceof PerspectiveCamera || camera instanceof OrthographicCamera) || !rooms.length) return;
    // Flush residual drag damping before starting a deterministic camera transition.
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damping;
    const command = previousCommand.current !== cameraRequest ? cameraRequest.action : null;
    previousCommand.current = cameraRequest;
    const model = node ? get().scene.getObjectByName(`${node.nodeType}:${node.nodeId}`) : undefined;
    model?.updateWorldMatrix(true, true);
    const box = model ? nodeFocusBounds(model).expandByScalar(.85) : node ? new Box3(new Vector3(node.x - 1.2, node.y - .8, node.z - 1.2), new Vector3(node.x + 1.2, node.y + .8, node.z + 1.2)) : roomBounds(room ? [room] : rooms);
    const center = box.getCenter(new Vector3());
    center.y = box.min.y + (box.max.y - box.min.y) * (node ? .5 : room ? .4 : .45);
    const start = new Spherical().setFromVector3(camera.position.clone().sub(controls.target)), end = start.clone();
    const zooming = command === 'zoom-in' || command === 'zoom-out', turning = command === 'turn-left' || command === 'turn-right';
    if (command && !zooming) Object.assign(end, cameraAngles(command, start.theta, start.phi));
    else if (model && !zooming) Object.assign(end, nodeFocusAngles(model, start.theta, start.phi));
    end.phi = Math.max(CAMERA_MIN_POLAR, Math.min(CAMERA_MAX_POLAR, end.phi));
    const distance = camera instanceof PerspectiveCamera ? fitDistance(box, center, end.theta, end.phi, camera.fov, size.width / Math.max(1, size.height)) : Math.max(30, box.getSize(new Vector3()).length() * 2);
    const control = get().controls as OrbitControlsImpl;
    control.maxDistance = Math.max(24, distance * 3);
    end.radius = camera instanceof OrthographicCamera ? zooming || turning ? start.radius : distance : zooming ? Math.max(control.minDistance, Math.min(control.maxDistance, start.radius * (command === 'zoom-in' ? .8 : 1.25))) : turning ? start.radius : node ? Math.max(DEVICE_FOCUS_MIN_DISTANCE, distance) : distance;
    const fitZoom = fitOrthographicZoom(box, center, end.theta, end.phi, size.width, size.height);
    control.minZoom = Math.max(.5, fitZoom / 5);
    control.maxZoom = Math.max(300, fitZoom * 5);
    const toZoom = camera instanceof OrthographicCamera ? zooming ? Math.max(control.minZoom, Math.min(control.maxZoom, camera.zoom * (command === 'zoom-in' ? 1.25 : .8))) : turning ? camera.zoom : fitZoom : camera.zoom;
    animation.current = { startedAt: null, start, end, from: controls.target.clone(), to: turning || zooming ? controls.target.clone() : center, fromZoom: camera.zoom, toZoom };
    invalidate();
  }, [rooms, room, node, request, cameraRequest, size, activeCamera, activeControls, get, invalidate]);
  useFrame(({ camera, controls: frameControls }) => {
    const controls = frameControls as OrbitControlsImpl | null;
    const move = animation.current;
    if (!move || !controls) return;
    move.startedAt ??= performance.now();
    const t = cameraTransitionProgress((performance.now() - move.startedAt) / 1000, reduced);
    orbit.set(move.start.radius + (move.end.radius - move.start.radius) * t, move.start.phi + (move.end.phi - move.start.phi) * t, move.start.theta + (move.end.theta - move.start.theta) * t);
    controls.target.lerpVectors(move.from, move.to, t);
    camera.position.copy(controls.target).add(offset.setFromSpherical(orbit));
    camera.zoom = move.fromZoom + (move.toZoom - move.fromZoom) * t;
    camera.updateProjectionMatrix();
    controls.update();
    if (t === 1) animation.current = null; else invalidate();
  });
  return null;
}
