import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { temperatureTicks } from "../src/app/chart";

describe("temperatureTicks", () => {
  it("labels every 5 °C inside the chart", () => {
    assert.deepEqual(
      temperatureTicks("°C").map((t) => t.label),
      ["10°", "15°", "20°", "25°", "30°", "35°"]
    );
  });

  it("labels every 10 °F, placed at their °C position", () => {
    const ticks = temperatureTicks("°F");
    assert.deepEqual(
      ticks.map((t) => t.label),
      ["50°", "60°", "70°", "80°", "90°", "100°"]
    );
    assert.equal(ticks[0].celsius, 10);
    assert.equal(ticks[5].celsius, (100 - 32) * (5 / 9));
  });

  it("labels kelvin with its unit", () => {
    assert.deepEqual(
      temperatureTicks("K").map((t) => t.label),
      ["280 K", "285 K", "290 K", "295 K", "300 K", "305 K", "310 K"]
    );
  });
});
