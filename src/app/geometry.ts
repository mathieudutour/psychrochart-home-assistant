/** Rounds `value` to the nearest multiple of `step`. */
export function snapTo(value: number, step = 1) {
  return step * Math.round(value / step);
}
