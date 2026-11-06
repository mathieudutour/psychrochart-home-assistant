import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type PickerHass,
  configForm,
  entitySuggestion,
  findSensorPair,
  stubConfig,
} from "../src/setup";

const sensor = (deviceClass: string) => ({ attributes: { device_class: deviceClass } });

const hass: PickerHass = {
  states: {
    "sensor.bedroom_temperature": sensor("temperature"),
    "sensor.bedroom_humidity": sensor("humidity"),
    "sensor.kitchen_temperature": sensor("temperature"),
    "sensor.outdoor_temperature": sensor("temperature"),
    "sensor.outdoor_humidity": sensor("humidity"),
    "sensor.pressure": sensor("atmospheric_pressure"),
    "climate.bedroom": sensor("temperature"),
  },
  entities: {
    "sensor.bedroom_temperature": { device_id: "bedroom" },
    "sensor.bedroom_humidity": { device_id: "bedroom" },
    "sensor.kitchen_temperature": { device_id: "kitchen" },
    "sensor.outdoor_temperature": { device_id: "outdoor" },
    "sensor.outdoor_humidity": { device_id: "outdoor" },
  },
};

describe("findSensorPair", () => {
  it("pairs sensors on the same device", () => {
    assert.deepEqual(findSensorPair(hass), {
      temperature: "sensor.bedroom_temperature",
      humidity: "sensor.bedroom_humidity",
    });
  });

  it("honours a preferred entity", () => {
    assert.deepEqual(findSensorPair(hass, "sensor.outdoor_humidity"), {
      temperature: "sensor.outdoor_temperature",
      humidity: "sensor.outdoor_humidity",
    });
  });

  it("finds nothing for a sensor without a partner", () => {
    assert.equal(findSensorPair(hass, "sensor.kitchen_temperature"), undefined);
    assert.equal(findSensorPair({ states: hass.states }), undefined);
  });
});

describe("stubConfig", () => {
  it("uses a paired set of sensors", () => {
    assert.deepEqual(stubConfig(hass), {
      temperature: "sensor.bedroom_temperature",
      humidity: "sensor.bedroom_humidity",
      hours: 24,
    });
  });

  it("falls back to any sensors, then to placeholders", () => {
    assert.deepEqual(stubConfig({ states: hass.states }), {
      temperature: "sensor.bedroom_temperature",
      humidity: "sensor.bedroom_humidity",
      hours: 24,
    });
    assert.deepEqual(stubConfig({ states: {} }), {
      temperature: "sensor.temperature",
      humidity: "sensor.humidity",
      hours: 24,
    });
    assert.deepEqual(stubConfig(undefined), stubConfig({ states: {} }));
  });
});

describe("entitySuggestion", () => {
  it("suggests the card for a sensor with a partner", () => {
    assert.deepEqual(entitySuggestion(hass, "sensor.bedroom_humidity"), {
      config: {
        type: "custom:psychro-chart-card",
        temperature: "sensor.bedroom_temperature",
        humidity: "sensor.bedroom_humidity",
      },
    });
  });

  it("does not suggest it for other entities", () => {
    assert.equal(entitySuggestion(hass, "sensor.kitchen_temperature"), null);
    assert.equal(entitySuggestion(hass, "sensor.pressure"), null);
    assert.equal(entitySuggestion(hass, "climate.bedroom"), null);
  });
});

describe("configForm", () => {
  const form = configForm();
  const names = JSON.stringify(form.schema).match(/"name":"\w+"/g);

  it("covers every config option", () => {
    assert.deepEqual(names, [
      '"name":"temperature"',
      '"name":"humidity"',
      '"name":"hours"',
      '"name":"outdoorTemperature"',
      '"name":"pressure"',
    ]);
  });

  it("rejects entity options that are not strings", () => {
    assert.doesNotThrow(() => form.assertConfig({ temperature: "sensor.t" }));
    assert.throws(() => form.assertConfig({ pressure: { entity: "sensor.p" } }));
  });
});
