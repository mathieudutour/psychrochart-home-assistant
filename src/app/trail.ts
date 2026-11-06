/** A history point in chart coordinates. */
export type TrailPoint = { x: number; y: number; time: number };

/** How many opacity steps the trail fades through. */
export const TRAIL_STEPS = 32;

/**
 * Splits the history trail into a few polylines, each drawn at one opacity,
 * fading from the oldest point to the newest. Drawing a handful of
 * polylines instead of one line per segment keeps the SVG small however
 * long the history is.
 *
 * Points less than `minDistance` (in chart units) from the previously kept
 * point are skipped, as they would not change the drawing. The newest point
 * is always kept.
 */
export function trailPolylines(
  points: TrailPoint[],
  steps = TRAIL_STEPS,
  minDistance = 1
) {
  if (points.length < 2) {
    return [];
  }

  const kept = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    const previous = kept[kept.length - 1];
    if (
      i === points.length - 1 ||
      Math.hypot(point.x - previous.x, point.y - previous.y) >= minDistance
    ) {
      kept.push(point);
    }
  }

  const first = kept[0].time;
  const span = kept[kept.length - 1].time - first;
  const polylines: { opacity: number; points: string }[] = [];
  let currentStep = -1;
  let coordinates: string[] = [];
  const format = (point: TrailPoint) =>
    `${point.x.toFixed(1)},${point.y.toFixed(1)}`;

  for (let i = 1; i < kept.length; i++) {
    // A segment's opacity follows the age of its newer end, as before.
    const progress = span > 0 ? (kept[i].time - first) / span : 1;
    const step = Math.min(steps - 1, Math.floor(progress * steps));
    if (step !== currentStep) {
      if (coordinates.length) {
        polylines.push({
          opacity: (currentStep + 1) / steps,
          points: coordinates.join(" "),
        });
      }
      currentStep = step;
      // Start at the previous point so consecutive polylines join up.
      coordinates = [format(kept[i - 1])];
    }
    coordinates.push(format(kept[i]));
  }
  polylines.push({ opacity: (currentStep + 1) / steps, points: coordinates.join(" ") });
  return polylines;
}
