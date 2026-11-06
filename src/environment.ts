import { parseNumericState } from "./history";
import {
  pressureToPascal,
  standardAtmosphericPressure,
} from "./app/physic";

/** Readings outside this range (Pa) are treated as sensor errors. */
const MIN_PLAUSIBLE_PRESSURE = 30000;
const MAX_PLAUSIBLE_PRESSURE = 120000;

export type PressureSource = "sensor" | "elevation";

type EntityState = {
  state: string;
  attributes?: { unit_of_measurement?: string };
};

/**
 * The air pressure (Pa) to use for the chart: the pressure sensor's reading
 * when it is valid, otherwise the standard atmosphere at Home Assistant's
 * configured elevation.
 */
export function resolvePressure(
  sensor: EntityState | undefined,
  elevationMeters: number | undefined
): { pressure: number; source: PressureSource } {
  if (sensor) {
    const value = parseNumericState(sensor.state);
    const pascals =
      value === undefined
        ? undefined
        : pressureToPascal(value, sensor.attributes?.unit_of_measurement);
    if (
      pascals !== undefined &&
      pascals >= MIN_PLAUSIBLE_PRESSURE &&
      pascals <= MAX_PLAUSIBLE_PRESSURE
    ) {
      return { pressure: pascals, source: "sensor" };
    }
  }
  const elevation = Number.isFinite(elevationMeters) ? elevationMeters! : 0;
  return {
    pressure: standardAtmosphericPressure(elevation),
    source: "elevation",
  };
}

/** How many days the outdoor temperature is averaged over. */
export const MEAN_OUTDOOR_DAYS = 30;

type CallWS = <T>(message: { type: string; [key: string]: unknown }) => Promise<T>;

/**
 * The mean outdoor temperature (°C) over the last 30 days, from Home
 * Assistant's long-term statistics. Returns undefined when the sensor has no
 * statistics, for example because it has no `state_class`.
 */
export async function fetchMeanOutdoorTemperature(
  callWS: CallWS,
  entityId: string
) {
  const result = await callWS<{ mean?: number | null }>({
    type: "recorder/statistic_during_period",
    statistic_id: entityId,
    types: ["mean"],
    units: { temperature: "°C" },
    rolling_window: { duration: { days: MEAN_OUTDOOR_DAYS } },
  });
  const mean = result?.mean;
  return typeof mean === "number" && Number.isFinite(mean) ? mean : undefined;
}
