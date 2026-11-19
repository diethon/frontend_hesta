import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Object3D } from 'three';
import type { TwinDeviceView } from '../../../types/twinView';
import { useReducedMotion } from '../useTwinMotion';
import { fanSpeed, openingFraction } from './deviceVisualState';

type Target = () => Object3D | null | undefined;

/** Fan blades: spin only while powered with a non-zero backend speed. */
export function useFanSpin(target: Target, device: TwinDeviceView, axis: 'y' | 'z', rate: (speed: number) => number) {
  const reduced = useReducedMotion(), invalidate = useThree((state) => state.invalidate);
  const speed = fanSpeed(device);
  useFrame((_, delta) => {
    const blades = target();
    if (!device.powered || reduced || !blades || speed === 0) return;
    blades.rotation[axis] += Math.min(delta, .05) * rate(speed);
    invalidate();
  });
}

/** AC louvre: opens while running and sweeps when swing is on. */
export function useAcFlap(target: Target, device: TwinDeviceView) {
  const reduced = useReducedMotion(), invalidate = useThree((state) => state.invalidate);
  const active = device.powered;
  const swing = device.state.swing === true || device.state.swing === 'ON';
  useEffect(() => { invalidate(); }, [active, swing, invalidate]);
  useFrame(({ clock }, delta) => {
    const flap = target();
    if (!flap) return;
    const goal = active ? -.4 + (swing && !reduced ? Math.sin(clock.elapsedTime * .8) * .15 : 0) : 0;
    const moving = Math.abs(flap.rotation.x - goal) > .001;
    flap.rotation.x += (goal - flap.rotation.x) * (reduced ? 1 : 1 - Math.exp(-Math.min(delta, .05) * 10));
    if (moving || active && swing && !reduced) invalidate();
  });
}

/**
 * Roller shutter in unit space (height 1): lifts `shutter` by the open fraction and hides
 * slats that have rolled into the housing. A small lip stays visible when fully open.
 */
export function useRollerShutter(target: Target, device: TwinDeviceView) {
  const reduced = useReducedMotion(), invalidate = useThree((state) => state.invalidate);
  const desired = openingFraction(device) * .96;
  const current = useRef<number | null>(null);
  useEffect(() => { invalidate(); }, [desired, invalidate]);
  useFrame((_, delta) => {
    const shutter = target();
    if (!shutter) return;
    const from = current.current ?? desired;
    const next = reduced ? desired : from + (desired - from) * (1 - Math.exp(-Math.min(delta, .05) * 3));
    current.current = Math.abs(next - desired) < .0005 ? desired : next;
    shutter.position.y = current.current;
    shutter.children.forEach((slat) => { slat.visible = slat.position.y + current.current! < 1 - .001; });
    if (current.current !== desired) invalidate();
  });
}
