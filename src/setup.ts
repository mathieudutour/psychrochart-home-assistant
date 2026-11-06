// Helpers for the dashboard's card picker and visual editor.

type State = { attributes?: { device_class?: string } };
type EntityEntry = { device_id?: string | null };

/** The parts of `hass` the picker helpers read. */
export type PickerHass = {
  states: Record<string, State>;
  /** Entity registry, available since Home Assistant 2023.3. */
  entities?: Record<string, EntityEntry>;
};

export const CARD_TYPE = "psychro-chart-card";

function sensorsOfClass(hass: PickerHass, deviceClass: string) {
  return Object.keys(hass.states)
    .filter(
      (id) =>
        id.startsWith("sensor.") &&
        hass.states[id].attributes?.device_class === deviceClass
    )
    .sort();
}

function deviceOf(hass: PickerHass, entityId: string) {
  return hass.entities?.[entityId]?.device_id ?? undefined;
}

/**
 * A temperature and a humidity sensor that belong together: on the same
 * device when possible. `prefer` pins one of the two.
 */
export function findSensorPair(hass: PickerHass, prefer?: string) {
  const temperatures = sensorsOfClass(hass, "temperature");
  const humidities = sensorsOfClass(hass, "humidity");

  const candidates: [string, string][] = [];
  for (const temperature of temperatures) {
    for (const humidity of humidities) {
      if (prefer && prefer !== temperature && prefer !== humidity) continue;
      const device = deviceOf(hass, temperature);
      if (device && device === deviceOf(hass, humidity)) {
        candidates.push([temperature, humidity]);
      }
    }
  }
  const [pair] = candidates;
  return pair ? { temperature: pair[0], humidity: pair[1] } : undefined;
}

/** A starting config for the card picker, using sensors that exist. */
export function stubConfig(hass: PickerHass | undefined) {
  const pair = hass ? findSensorPair(hass) : undefined;
  if (pair) {
    return { ...pair, hours: 24 };
  }
  return {
    temperature:
      (hass && sensorsOfClass(hass, "temperature")[0]) ?? "sensor.temperature",
    humidity: (hass && sensorsOfClass(hass, "humidity")[0]) ?? "sensor.humidity",
    hours: 24,
  };
}

/**
 * Offers the card in the picker for a temperature or humidity sensor whose
 * device also has the other measurement.
 */
export function entitySuggestion(hass: PickerHass, entityId: string) {
  const pair = findSensorPair(hass, entityId);
  return pair ? { config: { type: `custom:${CARD_TYPE}`, ...pair } } : null;
}

const PRESSURE_CLASSES = ["atmospheric_pressure", "pressure"];

/** The visual editor's form, rendered by Home Assistant's `ha-form`. */
export function configForm() {
  return {
    schema: [
      { name: "name", selector: { text: {} } },
      {
        type: "grid",
        name: "",
        flatten: true,
        schema: [
          {
            name: "temperature",
            required: true,
            selector: {
              entity: { filter: { domain: "sensor", device_class: "temperature" } },
            },
          },
          {
            name: "humidity",
            required: true,
            selector: {
              entity: { filter: { domain: "sensor", device_class: "humidity" } },
            },
          },
        ],
      },
      {
        name: "hours",
        selector: {
          number: { min: 1, max: 240, step: 1, mode: "box", unit_of_measurement: "h" },
        },
      },
      {
        name: "outdoorTemperature",
        selector: {
          entity: { filter: { domain: "sensor", device_class: "temperature" } },
        },
      },
      {
        name: "outdoorHumidity",
        selector: {
          entity: { filter: { domain: "sensor", device_class: "humidity" } },
        },
      },
      {
        name: "pressure",
        selector: {
          entity: { filter: { domain: "sensor", device_class: PRESSURE_CLASSES } },
        },
      },
    ],
    computeLabel: (schema: { name: string }) =>
      ({
        name: "Name (optional)",
        temperature: "Indoor temperature",
        humidity: "Indoor humidity",
        hours: "History window",
        outdoorTemperature: "Outdoor temperature (optional)",
        outdoorHumidity: "Outdoor humidity (optional)",
        pressure: "Barometric pressure (optional)",
      })[schema.name],
    computeHelper: (schema: { name: string }) =>
      ({
        outdoorTemperature:
          "Its mean over the last 30 days positions the comfort zone. Without it, a mean of 19 °C is assumed. Its current reading shows on hover.",
        outdoorHumidity:
          "With the outdoor temperature, shows the outdoor air as a point on hover.",
        pressure:
          "Must report the pressure where you are, not adjusted to sea level. Without it, the pressure at your Home Assistant elevation is used.",
      })[schema.name],
    assertConfig: (config: Record<string, unknown>) => {
      for (const key of [
        "name",
        "temperature",
        "humidity",
        "outdoorTemperature",
        "outdoorHumidity",
        "pressure",
      ]) {
        if (config[key] !== undefined && typeof config[key] !== "string") {
          throw new Error(`${key} must be text, such as an entity ID`);
        }
      }
    },
  };
}
