const EPSILON = 1e-6;

export function snapTo(e: number, t = 1) {
  return t * Math.round(e / t);
}

export function closeTo(a: number, b: number, delta = EPSILON) {
  return !isNaN(a) && a > b + delta && a < b - delta;
}

export function interpolate(min: number, n: number, max: number) {
  return min + n * (max - min);
}

export function clamp(n: number, min: number, max: number) {
  if (isNaN(n)) return min;
  if (max < min) {
    if (n > min) return min;
    if (n < max) return max;
  } else {
    if (n < min) return min;
    if (n > max) return max;
  }
  return n;
}

export function mapAndClamp(
  value: number,
  minValue: number,
  maxValue: number,
  min: number,
  max: number
) {
  const delta = maxValue - minValue;
  return Math.abs(delta) < EPSILON
    ? 0.5 * (min + max)
    : clamp(interpolate(min, (value - minValue) / delta, max), min, max);
}
