// Formatting that follows the user's Home Assistant settings: their
// language, number format and each entity's display precision.

import { parseNumericState } from "./history";

type EntityState = {
  state: string;
  attributes?: { unit_of_measurement?: string; [key: string]: unknown };
};

type ValuePart = { type: string; value: string };

/** The parts of `hass` used for formatting. All are optional, as they were
 * added over time. */
export type FormatHass = {
  formatEntityStateToParts?: (stateObj: any) => ValuePart[];
  formatEntityState?: (stateObj: any) => string;
  localize?: (key: string) => string;
  locale?: { language?: string; number_format?: string };
};

/** A reading as the readout shows it. */
export type Reading = {
  value: string;
  unit?: string;
  /** Some languages put the unit before the value. */
  unitFirst: boolean;
  /** False when the sensor is unavailable, unknown or not a number. */
  available: boolean;
};

/** A Home Assistant translation, or `fallback` when there is none. */
export function localize(hass: FormatHass | undefined, key: string, fallback: string) {
  const text = hass?.localize?.(key);
  return text && text !== key ? text : fallback;
}

/**
 * Formats a sensor's current state like the built-in cards: with its display
 * precision and the user's number format, and its state translated when it
 * is not a number.
 */
export function formatReading(hass: FormatHass | undefined, stateObj: EntityState): Reading {
  const available = parseNumericState(stateObj.state) !== undefined;
  const unitOfMeasurement = stateObj.attributes?.unit_of_measurement;

  if (hass?.formatEntityStateToParts) {
    const parts = hass.formatEntityStateToParts(stateObj);
    const valueIndex = parts.findIndex((part) => part.type === "value");
    const unitIndex = parts.findIndex((part) => part.type === "unit");
    const value = parts
      .filter((part) => part.type === "value")
      .map((part) => part.value)
      .join("");
    if (value) {
      return {
        value,
        unit: unitIndex === -1 ? undefined : parts[unitIndex].value,
        unitFirst: unitIndex !== -1 && unitIndex < valueIndex,
        available,
      };
    }
  }

  if (hass?.formatEntityState) {
    const text = hass.formatEntityState(stateObj).trim();
    if (available && unitOfMeasurement && text.endsWith(unitOfMeasurement)) {
      return {
        value: text.slice(0, -unitOfMeasurement.length).trim(),
        unit: unitOfMeasurement,
        unitFirst: false,
        available,
      };
    }
    return { value: text, unit: available ? unitOfMeasurement : undefined, unitFirst: false, available };
  }

  return {
    value: available
      ? stateObj.state
      : localize(hass, `state.default.${stateObj.state}`, stateObj.state),
    unit: available ? unitOfMeasurement : undefined,
    unitFirst: false,
    available,
  };
}

/**
 * The locale for formatting numbers, from the user's number format setting,
 * as the Home Assistant frontend maps it.
 */
function numberLocale(hass: FormatHass | undefined): string | undefined {
  switch (hass?.locale?.number_format) {
    case "comma_decimal":
      return "en-US";
    case "decimal_comma":
      return "de";
    case "space_comma":
      return "fr";
    case "system":
      return undefined;
    default:
      return hass?.locale?.language;
  }
}

/** Formats a number the card computed, such as the dew point. */
export function formatNumber(
  hass: FormatHass | undefined,
  value: number,
  fractionDigits = 1
) {
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: hass?.locale?.number_format !== "none",
  };
  try {
    return new Intl.NumberFormat(numberLocale(hass), options).format(value);
  } catch {
    // An unknown language code.
    return new Intl.NumberFormat(undefined, options).format(value);
  }
}
