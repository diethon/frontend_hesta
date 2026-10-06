// Adapted from NeonPlan 3D, bb5261d29fc45ba0bb4a586bca2500f94ec9ea1d.
// Copyright (c) 2026 Mastershort. MIT; see THIRD_PARTY_NOTICES.md.
// HESTA renderer-only port: no integration or external asset packs.

// Heatmap: a room's floor takes a colour from the value of its sensors (temperature, humidity, CO₂).


export type HeatMode = "none" | "temperature" | "humidity" | "co2";

type Rgb = [number, number, number];

/** Colour stops per mode: value and colour. */
export const HEAT_SCALES: Record<Exclude<HeatMode, "none">, { unit: string; stops: [number, Rgb][] }> = {
  temperature: {
    unit: "°C",
    stops: [
      [17, [0.24, 0.48, 1]],
      [20.5, [0.2, 0.9, 0.7]],
      [23, [1, 0.75, 0.25]],
      [25.5, [1, 0.32, 0.2]],
    ],
  },
  humidity: {
    unit: "%",
    stops: [
      [30, [1, 0.6, 0.2]],
      [45, [0.3, 0.9, 0.5]],
      [60, [0.2, 0.8, 1]],
      [75, [0.3, 0.4, 1]],
    ],
  },
  co2: {
    unit: "ppm",
    stops: [
      [450, [0.3, 0.9, 0.5]],
      [800, [1, 0.85, 0.3]],
      [1200, [1, 0.5, 0.2]],
      [1600, [1, 0.25, 0.25]],
    ],
  },
};

/** Colour of a value on a scale (clamped to the first and last stop). */
export function heatColor(mode: Exclude<HeatMode, "none">, value: number): Rgb {
  const stops = HEAT_SCALES[mode].stops;
  if (value <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [v1, c1] = stops[i];
    const [v0, c0] = stops[i - 1];
    if (value <= v1) {
      const t = (value - v0) / (v1 - v0);
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
    }
  }
  return stops[stops.length - 1][1];
}

/** CSS gradient of a scale, for the legend. */
export function heatGradient(mode: Exclude<HeatMode, "none">): string {
  const stops = HEAT_SCALES[mode].stops;
  const lo = stops[0][0];
  const hi = stops[stops.length - 1][0];
  return `linear-gradient(90deg, ${stops.map(([v, c]) => `rgb(${c.map((x) => Math.round(x * 255)).join(",")}) ${Math.round(((v - lo) / (hi - lo)) * 100)}%`).join(", ")})`;
}
