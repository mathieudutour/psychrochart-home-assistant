import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatNumber, formatReading, localize } from "../src/format";

const temperature = (state: string) => ({
  state,
  attributes: { unit_of_measurement: "°C" },
});

describe("formatReading", () => {
  it("uses Home Assistant's parts, keeping the unit's position", () => {
    const hass = {
      formatEntityStateToParts: () => [
        { type: "value", value: "21,5" },
        { type: "literal", value: " " },
        { type: "unit", value: "°C" },
      ],
    };
    assert.deepEqual(formatReading(hass, temperature("21.5")), {
      value: "21,5",
      unit: "°C",
      unitFirst: false,
      available: true,
    });

    const unitFirst = {
      formatEntityStateToParts: () => [
        { type: "unit", value: "$" },
        { type: "value", value: "3" },
      ],
    };
    assert.equal(formatReading(unitFirst, temperature("3")).unitFirst, true);
  });

  it("marks unavailable sensors, with the translated state", () => {
    const hass = {
      formatEntityStateToParts: () => [{ type: "value", value: "Indisponible" }],
    };
    assert.deepEqual(formatReading(hass, temperature("unavailable")), {
      value: "Indisponible",
      unit: undefined,
      unitFirst: false,
      available: false,
    });
  });

  it("splits formatEntityState on older Home Assistant versions", () => {
    const hass = { formatEntityState: () => "21,5 °C" };
    assert.deepEqual(formatReading(hass, temperature("21.5")), {
      value: "21,5",
      unit: "°C",
      unitFirst: false,
      available: true,
    });
  });

  it("falls back to the raw state, translating non-numeric ones", () => {
    assert.deepEqual(formatReading(undefined, temperature("21.5")), {
      value: "21.5",
      unit: "°C",
      unitFirst: false,
      available: true,
    });
    const hass = {
      localize: (key: string) => (key === "state.default.unknown" ? "Inconnu" : ""),
    };
    assert.equal(formatReading(hass, temperature("unknown")).value, "Inconnu");
    assert.equal(formatReading(hass, temperature("unknown")).unit, undefined);
  });
});

describe("formatNumber", () => {
  it("follows the language", () => {
    assert.equal(formatNumber({ locale: { language: "fr" } }, 10.24), "10,2");
    assert.equal(formatNumber({ locale: { language: "en" } }, 10.24), "10.2");
  });

  it("follows the number format setting", () => {
    assert.equal(
      formatNumber({ locale: { language: "fr", number_format: "comma_decimal" } }, 1234.5),
      "1,234.5"
    );
    assert.equal(
      formatNumber({ locale: { language: "en", number_format: "decimal_comma" } }, 1234.5),
      "1.234,5"
    );
    assert.equal(
      formatNumber({ locale: { language: "en", number_format: "none" } }, 1234.5),
      "1234.5"
    );
  });

  it("survives an unknown language", () => {
    assert.match(formatNumber({ locale: { language: "not a language" } }, 1.5), /1[.,]5/);
  });
});

describe("localize", () => {
  it("uses the translation, or the fallback when there is none", () => {
    const hass = { localize: (key: string) => (key === "a" ? "Translated" : key) };
    assert.equal(localize(hass, "a", "Fallback"), "Translated");
    assert.equal(localize(hass, "b", "Fallback"), "Fallback");
    assert.equal(localize(undefined, "a", "Fallback"), "Fallback");
  });
});
