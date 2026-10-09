import type { TwinSceneObject } from '../twinDrafting';

/** Build real wall openings; overlapping openings cannot produce negative geometry. */
export function wallSegments(length: number, height: number, openings: readonly { center: number; object: TwinSceneObject }[]) {
  const holes = openings.map(({ center, object }) => ({
    left: Math.max(-length / 2, center - object.width / 2), right: Math.min(length / 2, center + object.width / 2),
    bottom: object.kind === 'WINDOW' ? Math.min(.8, height) : 0,
    top: Math.min(height, object.height + (object.kind === 'WINDOW' ? .8 : 0)),
  })).filter((hole) => hole.right > hole.left);
  const edges = [...new Set([-length / 2, length / 2, ...holes.flatMap((hole) => [hole.left, hole.right])])].sort((a, b) => a - b);
  return edges.slice(0, -1).flatMap((left, index) => {
    const right = edges[index + 1];
    const covering = holes.filter((hole) => hole.left < right && hole.right > left);
    const bottom = covering.length ? Math.min(...covering.map((hole) => hole.bottom)) : height;
    const top = covering.length ? Math.max(...covering.map((hole) => hole.top)) : height;
    const regions = [[0, bottom], [top, height]];
    return regions.filter(([low, high]) => high - low > .001).map(([low, high]) => ({ x: (left + right) / 2, y: (low + high) / 2, width: right - left, height: high - low }));
  });
}
