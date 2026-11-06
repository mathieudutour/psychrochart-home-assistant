import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type TrailPoint, trailPolylines } from "../src/app/trail";

const line = (count: number, spacing = 2): TrailPoint[] =>
  Array.from({ length: count }, (_, i) => ({ x: i * spacing, y: 0, time: i }));

describe("trailPolylines", () => {
  it("draws nothing for fewer than two points", () => {
    assert.deepEqual(trailPolylines([]), []);
    assert.deepEqual(trailPolylines(line(1)), []);
  });

  it("uses at most one polyline per opacity step, however long the history", () => {
    const polylines = trailPolylines(line(10000), 32);
    assert.equal(polylines.length, 32);
    assert.equal(polylines[polylines.length - 1].opacity, 1);
    for (let i = 1; i < polylines.length; i++) {
      assert.ok(polylines[i].opacity > polylines[i - 1].opacity, "fades in");
    }
  });

  it("joins consecutive polylines and keeps every segment", () => {
    const polylines = trailPolylines(line(100), 4);
    for (let i = 1; i < polylines.length; i++) {
      const previousEnd = polylines[i - 1].points.split(" ").at(-1);
      assert.equal(polylines[i].points.split(" ")[0], previousEnd);
    }
    // 99 segments over 4 polylines: each extra polyline repeats one point.
    const total = polylines.reduce((n, p) => n + p.points.split(" ").length, 0);
    assert.equal(total, 100 + polylines.length - 1);
  });

  it("skips points too close to draw, but keeps the newest", () => {
    const points: TrailPoint[] = [
      { x: 0, y: 0, time: 0 },
      { x: 0.2, y: 0, time: 1 },
      { x: 0.4, y: 0.3, time: 2 },
      { x: 5, y: 0, time: 3 },
      { x: 5.1, y: 0, time: 4 },
    ];
    assert.deepEqual(trailPolylines(points, 1), [
      { opacity: 1, points: "0.0,0.0 5.0,0.0 5.1,0.0" },
    ]);
  });

  it("draws points with the same timestamp at full opacity", () => {
    const points = [
      { x: 0, y: 0, time: 5 },
      { x: 10, y: 0, time: 5 },
    ];
    assert.deepEqual(trailPolylines(points), [
      { opacity: 1, points: "0.0,0.0 10.0,0.0" },
    ]);
  });
});
