import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getComfortZone, relativeHumidityCurve } from "../src/app/getComfortZone";
import {
  STANDARD_SEA_LEVEL_PRESSURE as P,
  humidityRatio,
  standardAtmosphericPressure,
} from "../src/app/physic";

describe("relativeHumidityCurve", () => {
  it("includes both ends and follows the curve", () => {
    const points = relativeHumidityCurve(50, 10, 30, P);
    assert.deepEqual(points[0], [10, humidityRatio(10, 50, P)]);
    assert.deepEqual(points[points.length - 1], [30, humidityRatio(30, 50, P)]);
    for (const [t, w] of points) {
      assert.ok(Math.abs(w - humidityRatio(t, 50, P)) < 1e-9);
    }
  });

  it("clips at the humidity limit and adds the crossing point", () => {
    const points = relativeHumidityCurve(80, 20, 30, P, 16);
    assert.ok(points.every(([, w]) => w <= 16));
    const crossing = points.find(([, w], i) => w === 16 && points[i - 1][1] < 16);
    assert.ok(crossing, "has a point where the curve reaches the limit");
    assert.ok(Math.abs(humidityRatio(crossing[0], 80, P) - 16) < 1e-6);
  });
});

describe("getComfortZone", () => {
  it("follows the mean outdoor temperature, not the indoor reading", () => {
    // Auliciems: 17.6 + 0.31 × 19 − 3.5 = 19.99 → 20.0 °C.
    const mild = getComfortZone(19, false, P);
    assert.equal(mild.minComfortTemp, 20);
    assert.equal(mild.maxComfortTemp, 27);

    const cold = getComfortZone(5, false, P);
    const hot = getComfortZone(30, false, P);
    assert.ok(cold.minComfortTemp < mild.minComfortTemp);
    assert.ok(hot.minComfortTemp > mild.minComfortTemp);
  });

  it("is wider and cooler in winter", () => {
    const zone = getComfortZone(19, true, P);
    assert.equal(zone.minComfortTemp, 18);
    assert.equal(zone.maxComfortTemp, 27);
  });

  it("stays within 20–80% RH and 16 g/kg", () => {
    for (const pressure of [P, standardAtmosphericPressure(1500)]) {
      for (const mean of [0, 19, 33]) {
        const { points, minComfortTemp, maxComfortTemp } = getComfortZone(
          mean,
          false,
          pressure
        );
        for (const [t, w] of points) {
          assert.ok(t >= minComfortTemp - 1e-9 && t <= maxComfortTemp + 1e-9);
          assert.ok(w <= 16 + 1e-9, `${w} g/kg exceeds the limit`);
          assert.ok(w >= humidityRatio(t, 20, pressure) - 1e-9);
          assert.ok(w <= humidityRatio(t, 80, pressure) + 1e-9);
        }
      }
    }
  });
});
