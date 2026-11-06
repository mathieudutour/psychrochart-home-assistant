import assert from "node:assert/strict";
import { describe, it } from "node:test";
import psychrolib from "psychrolib";
import {
  STANDARD_SEA_LEVEL_PRESSURE,
  humidityRatio,
  pressureToPascal,
  saturationHumidityRatio,
  saturationVaporPressure,
  standardAtmosphericPressure,
} from "../src/app/physic";

psychrolib.SetUnitSystem(psychrolib.SI);

function assertClose(actual: number, expected: number, relative: number) {
  assert.ok(
    Math.abs(actual - expected) <= relative * Math.abs(expected),
    `${actual} is not within ${relative * 100}% of ${expected}`
  );
}

describe("saturationVaporPressure", () => {
  // ASHRAE Handbook—Fundamentals (2017), chapter 1, table 3.
  const table: [number, number][] = [
    [-60, 1.08],
    [-20, 103.24],
    [-5, 401.74],
    [5, 872.6],
    [25, 3169.7],
    [50, 12351.3],
    [100, 101418.0],
  ];
  for (const [temperature, pressure] of table) {
    it(`matches the ASHRAE table at ${temperature} °C`, () => {
      assertClose(saturationVaporPressure(temperature), pressure, 0.002);
    });
  }

  it("is continuous at the triple point", () => {
    assertClose(saturationVaporPressure(0.01), saturationVaporPressure(0.0100001), 1e-6);
  });

  it("returns NaN outside −100 °C to 200 °C", () => {
    assert.ok(Number.isNaN(saturationVaporPressure(-101)));
    assert.ok(Number.isNaN(saturationVaporPressure(201)));
    assert.ok(Number.isNaN(saturationVaporPressure(NaN)));
  });
});

describe("standardAtmosphericPressure", () => {
  // ASHRAE Handbook—Fundamentals (2017), chapter 1, table 1.
  const table: [number, number][] = [
    [-500, 107478],
    [0, 101325],
    [1500, 84556],
    [4000, 61640],
  ];
  for (const [altitude, pressure] of table) {
    it(`matches the ASHRAE table at ${altitude} m`, () => {
      assertClose(standardAtmosphericPressure(altitude), pressure, 1e-4);
    });
  }
});

describe("humidityRatio", () => {
  it("matches PsychroLib across the chart", () => {
    for (const pressure of [STANDARD_SEA_LEVEL_PRESSURE, 84556]) {
      for (let temperature = -20; temperature <= 50; temperature += 2.5) {
        for (let rh = 5; rh <= 100; rh += 5) {
          const expected =
            1000 * psychrolib.GetHumRatioFromRelHum(temperature, rh / 100, pressure);
          assertClose(humidityRatio(temperature, rh, pressure), expected, 1e-9);
        }
      }
    }
  });

  it("uses the vapour pressure, not RH × saturation humidity ratio", () => {
    // At 25 °C and 50% RH the two differ by about 1.6%.
    const ratio = humidityRatio(25, 50);
    assertClose(ratio, 9.881, 1e-3);
    assert.ok(ratio < 0.5 * saturationHumidityRatio(25));
  });

  it("is higher at altitude for the same temperature and RH", () => {
    const seaLevel = humidityRatio(25, 50, standardAtmosphericPressure(0));
    const highUp = humidityRatio(25, 50, standardAtmosphericPressure(1500));
    assertClose(highUp / seaLevel, 1.2, 0.01);
  });

  it("is zero for dry air", () => {
    assert.equal(humidityRatio(20, 0), 0);
  });
});

describe("pressureToPascal", () => {
  it("converts Home Assistant pressure units", () => {
    assert.equal(pressureToPascal(1013.25, "hPa"), 101325);
    assert.equal(pressureToPascal(1013.25, "mbar"), 101325);
    assert.equal(pressureToPascal(101.325, "kPa"), 101325);
    assertClose(pressureToPascal(29.92, "inHg")!, 101320, 1e-4);
    assertClose(pressureToPascal(14.696, "psi")!, 101325, 1e-4);
    assertClose(pressureToPascal(760, "mmHg")!, 101325, 1e-4);
  });

  it("returns undefined for an unknown unit", () => {
    assert.equal(pressureToPascal(1013, undefined), undefined);
    assert.equal(pressureToPascal(1013, "atm"), undefined);
  });
});
