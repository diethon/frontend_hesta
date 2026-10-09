import type { TwinLayoutGeometry, TwinNodeLayout, TwinRoomLayout } from '../../types/twinLayout';

export function layoutViewportBounds(geometry: TwinLayoutGeometry) {
  if (!geometry.rooms.length) return { left: 0, top: 0, right: 1, bottom: 1 };
  // Include existing nodes outside rooms so fitting never hides placed objects.
  return {
    left: Math.min(...geometry.rooms.map((room) => room.x), ...geometry.nodes.map((node) => node.x)),
    top: Math.min(...geometry.rooms.map((room) => room.y), ...geometry.nodes.map((node) => node.y)),
    right: Math.max(...geometry.rooms.map((room) => room.x + room.width), ...geometry.nodes.map((node) => node.x)),
    bottom: Math.max(...geometry.rooms.map((room) => room.y + room.height), ...geometry.nodes.map((node) => node.y)),
  };
}

export function fitLayoutViewport(bounds: ReturnType<typeof layoutViewportBounds>, width: number, height: number, zoom = 1) {
  const scale = Math.min(4, .82 / Math.max(bounds.right - bounds.left, bounds.bottom - bounds.top, .01)) * zoom;
  const canvasWidth = width * scale;
  const canvasHeight = height * scale;
  const centerX = (bounds.left + bounds.right) / 2 * canvasWidth;
  const centerY = (bounds.top + bounds.bottom) / 2 * canvasHeight;
  const left = Math.max(0, width / 2 - centerX);
  const top = Math.max(0, height / 2 - centerY);
  return { canvasWidth, canvasHeight, left, top, scrollLeft: Math.max(0, centerX - width / 2), scrollTop: Math.max(0, centerY - height / 2) };
}

export const roomHeaderHeight = (roomHeight: number) => Math.min(60, Math.max(30, roomHeight * .35));

// Display coordinates only. Drag/drop and persistence always use the original node.
export function nodeDisplayPosition(node: TwinNodeLayout, rooms: readonly TwinRoomLayout[], width: number, height: number) {
  const inset = 20;
  const x = Math.max(inset, Math.min(width - inset, node.x * width));
  let y = Math.max(inset, Math.min(height - inset, node.y * height));
  const room = [...rooms].reverse().find((item) => node.x >= item.x && node.x <= item.x + item.width && node.y >= item.y && node.y <= item.y + item.height);
  if (room) {
    const safeTop = room.y * height + roomHeaderHeight(room.height * height) + inset;
    const safeBottom = (room.y + room.height) * height - inset;
    if (safeBottom >= safeTop) y = Math.max(safeTop, Math.min(safeBottom, y));
    else y = Math.min(height - inset, safeTop);
  }
  return { x, y };
}
