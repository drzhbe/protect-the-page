import type { Id, Position } from "./types";

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const isInRange = (a: Position, b: Position, range: number) => {
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  return distance < range;
};
