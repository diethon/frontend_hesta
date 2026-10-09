// Adapted from NeonPlan 3D, bb5261d29fc45ba0bb4a586bca2500f94ec9ea1d.
// Copyright (c) 2026 Mastershort. MIT; see THIRD_PARTY_NOTICES.md.
// HESTA renderer-only port: no integration or external asset packs.

import type { LampModel } from '../model';
import { WALL_LAMP_Y } from '../model';
import { DEG, GeoBuffer, pushPrism } from './geo';
const LAMP_BODY = 0x6f7c8b;
const LAMP_SIZE: Record<LampModel, [number, number, number]> = { ceiling: [.5,.5,.08], downlight: [.13,.13,.04], spot: [.12,.12,.12], panel: [.6,.6,.03], pendant: [.45,.45,.85], floor: [.38,.38,1.55], uplight: [.35,.35,1.65], table: [.25,.25,.4], wall: [.22,.12,.25], strip: [1.2,.04,.03], bollard: [.16,.16,.75], garden: [.14,.14,.35] };
interface LampPlacement { x: number; z: number; size?: [number, number, number]; base?: number; rotation?: number; variant?: string | null; lamp: LampModel; }
export function pushLampModel(
  buf: GeoBuffer,
  d: LampPlacement,
  H: number,
  shadeCol: number,
): void {
  const [w, dd, h] = d.size ?? LAMP_SIZE[d.lamp];
  const base = d.base ?? 0;
  const ang = (d.rotation ?? 0) * DEG;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const L = (x: number, z: number): [number, number] => [d.x + x * ca - z * sa, d.z + x * sa + z * ca];
  const cyl = (r: number, y0: number, y1: number, side: number, top: number, n = 14) => {
    const poly: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      poly.push([d.x + Math.cos(a) * r, d.z + Math.sin(a) * r]);
    }
    pushPrism(buf, poly, y0, y1, side, top, { aoFrom: 0, bottom: true });
  };
  const box = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, side: number, top = side) =>
    pushPrism(buf, [L(x0, z0), L(x1, z0), L(x1, z1), L(x0, z1)], y0, y1, side, top, { aoFrom: 0, bottom: true });
  const r = Math.max(0.05, Math.min(w, dd) / 2);
  switch (d.lamp) {
    case "ceiling":
      cyl(r * 0.25, H - 0.04, H, LAMP_BODY, LAMP_BODY, 8);
      cyl(r, H - Math.max(0.04, h) - 0.035, H - 0.04, shadeCol, shadeCol);
      break;
    case "pendant": {
      const bottom = Math.max(0.4, H - h);
      cyl(0.06, H - 0.02, H, LAMP_BODY, LAMP_BODY, 8);
      const shapeTop = d.variant === "globe" ? bottom + 2 * r : d.variant === "drum" ? bottom + 0.24 : bottom + 0.2;
      cyl(0.008, shapeTop, H - 0.02, LAMP_BODY, LAMP_BODY, 5);
      if (d.variant === "globe") {
        // stacked rings approximate a ball
        const n = 7;
        for (let i = 0; i < n; i++) {
          const a0 = Math.PI * (i / n);
          const a1 = Math.PI * ((i + 1) / n);
          cyl(r * Math.max(0.2, Math.sin((a0 + a1) / 2)), bottom + r - r * Math.cos(a0), bottom + r - r * Math.cos(a1), shadeCol, shadeCol, 14);
        }
      } else if (d.variant === "cone") {
        const n = 4;
        for (let i = 0; i < n; i++) cyl(r * (0.25 + (0.75 * (n - i)) / n), bottom + 0.06 * i, bottom + 0.06 * (i + 1), shadeCol, shadeCol, 16);
      } else if (d.variant === "drum") {
        cyl(r, bottom, bottom + 0.24, shadeCol, shadeCol, 18);
      } else {
        cyl(r * 0.35, bottom + 0.14, bottom + 0.2, shadeCol, shadeCol, 12);
        cyl(r, bottom, bottom + 0.14, shadeCol, shadeCol, 16);
      }
      break;
    }
    case "downlight":
      // flush ring in the ceiling with a glowing lens
      cyl(r, H - 0.012, H, LAMP_BODY, LAMP_BODY, 12);
      cyl(r * 0.7, H - 0.02, H - 0.012, shadeCol, shadeCol, 12);
      break;
    case "spot":
      cyl(r * 0.6, H - 0.02, H, LAMP_BODY, LAMP_BODY, 10);
      cyl(r, H - Math.max(0.06, h), H - 0.02, LAMP_BODY, LAMP_BODY, 12);
      cyl(r * 0.8, H - Math.max(0.06, h) - 0.008, H - Math.max(0.06, h), shadeCol, shadeCol, 12);
      break;
    case "panel":
      box(-w / 2, w / 2, -dd / 2, dd / 2, H - Math.max(0.015, h), H, LAMP_BODY, LAMP_BODY);
      box(-w / 2 + 0.02, w / 2 - 0.02, -dd / 2 + 0.02, dd / 2 - 0.02, H - Math.max(0.015, h) - 0.004, H - Math.max(0.015, h), shadeCol);
      break;
    case "uplight":
      cyl(Math.max(0.1, r * 0.6), base, base + 0.03, LAMP_BODY, LAMP_BODY);
      cyl(0.014, base + 0.03, base + h - 0.12, LAMP_BODY, LAMP_BODY, 6);
      // bowl open to the top: dark outside, glowing rim
      cyl(r, base + h - 0.14, base + h - 0.02, LAMP_BODY, LAMP_BODY);
      cyl(r * 0.92, base + h - 0.02, base + h, shadeCol, shadeCol);
      break;
    case "bollard":
      // path light: post with a glowing band under its cap
      cyl(r, base, base + h - 0.14, LAMP_BODY, LAMP_BODY, 10);
      cyl(r * 0.9, base + h - 0.14, base + h - 0.03, shadeCol, shadeCol, 10);
      cyl(r * 1.1, base + h - 0.03, base + h, LAMP_BODY, LAMP_BODY, 10);
      break;
    case "garden":
      // spike in the ground, head pointing up
      cyl(0.012, base, base + h - 0.08, LAMP_BODY, LAMP_BODY, 5);
      cyl(r, base + h - 0.08, base + h - 0.01, LAMP_BODY, LAMP_BODY, 10);
      cyl(r * 0.8, base + h - 0.01, base + h, shadeCol, shadeCol, 10);
      break;
    case "floor":
      cyl(Math.max(0.1, r * 0.7), base, base + 0.03, LAMP_BODY, LAMP_BODY);
      cyl(0.014, base + 0.03, base + h - 0.28, LAMP_BODY, LAMP_BODY, 6);
      cyl(r, base + h - 0.3, base + h, shadeCol, shadeCol);
      break;
    case "table":
      cyl(Math.max(0.05, r * 0.55), base, base + 0.03, LAMP_BODY, LAMP_BODY);
      cyl(0.012, base + 0.03, base + h - 0.16, LAMP_BODY, LAMP_BODY, 6);
      cyl(r, base + h - 0.18, base + h, shadeCol, shadeCol);
      break;
    case "wall": {
      // plate on the wall (back at -z) and a glowing shade in front of it
      const y0 = d.base ?? WALL_LAMP_Y;
      box(-w / 2 + 0.03, w / 2 - 0.03, -dd / 2, -dd / 2 + 0.02, y0, y0 + h, LAMP_BODY);
      box(-w / 2, w / 2, -dd / 2 + 0.02, dd / 2, y0 + h * 0.15, y0 + h * 0.85, shadeCol);
      break;
    }
    case "strip": {
      // a thin bar along the wall: under the ceiling (cove light) or at its mount height
      const y1 = d.base != null ? d.base + Math.max(0.02, h) : H - 0.04;
      box(-w / 2, w / 2, -dd / 2, dd / 2, y1 - Math.max(0.02, h), y1, shadeCol);
      break;
    }
  }
}
