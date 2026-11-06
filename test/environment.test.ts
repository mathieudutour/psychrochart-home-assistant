import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchMeanOutdoorTemperature, resolvePressure } from "../src/environment";
import { standardAtmosphericPressure } from "../src/app/physic";

const sensor = (state: string, unit?: string) => ({
  state,
  attributes: { unit_of_measurement: unit },
});

describe("resolvePressure", () => {
  it("uses a valid pressure sensor, converting its unit", () => {
    assert.deepEqual(resolvePressure(sensor("1013.25", "hPa"), 1500), {
      pressure: 101325,
      source: "sensor",
    });
    assert.equal(resolvePressure(sensor("84.5", "kPa"), 0).pressure, 84500);
  });

  it("falls back to the standard atmosphere at the elevation", () => {
    const expected = {
      pressure: standardAtmosphericPressure(1500),
      source: "elevation",
    };
    assert.deepEqual(resolvePressure(undefined, 1500), expected);
    assert.deepEqual(resolvePressure(sensor("unavailable", "hPa"), 1500), expected);
    assert.deepEqual(resolvePressure(sensor("1013", "atm"), 1500), expected);
    // A reading in hPa labelled as Pa is far too low to be real.
    assert.deepEqual(resolvePressure(sensor("1013", "Pa"), 1500), expected);
  });

  it("assumes sea level when the elevation is unknown", () => {
    assert.equal(resolvePressure(undefined, undefined).pressure, 101325);
  });
});

describe("fetchMeanOutdoorTemperature", () => {
  it("asks for the 30-day mean in °C", async () => {
    let sent: any;
    const mean = await fetchMeanOutdoorTemperature(async (message: any) => {
      sent = message;
      return { mean: 8.4 } as any;
    }, "sensor.outdoor");
    assert.equal(mean, 8.4);
    assert.deepEqual(sent, {
      type: "recorder/statistic_during_period",
      statistic_id: "sensor.outdoor",
      types: ["mean"],
      units: { temperature: "°C" },
      rolling_window: { duration: { days: 30 } },
    });
  });

  it("returns undefined when there are no statistics", async () => {
    assert.equal(
      await fetchMeanOutdoorTemperature(async () => ({}) as any, "sensor.x"),
      undefined
    );
    assert.equal(
      await fetchMeanOutdoorTemperature(async () => ({ mean: null }) as any, "sensor.x"),
      undefined
    );
  });
});
