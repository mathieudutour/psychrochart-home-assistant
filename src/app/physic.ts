// Psychrometric relations for moist air, in SI units.
//
// Equations are from ASHRAE Handbook—Fundamentals (2017), chapter 1,
// "Psychrometrics". Equation numbers below refer to that chapter.
//
// Units used throughout:
//   temperature        °C (dry bulb)
//   relative humidity  % (0–100)
//   pressure           Pa
//   humidity ratio     g of water vapour per kg of dry air

/** Standard atmospheric pressure at sea level, in Pa. */
export const STANDARD_SEA_LEVEL_PRESSURE = 101325;

/** Ratio of the molar masses of water vapour and dry air (eq. 20). */
const MOLAR_MASS_RATIO = 0.621945;

/** Below this temperature (°C) saturation is over ice, above it over water. */
const TRIPLE_POINT_OF_WATER = 0.01;

const ABSOLUTE_ZERO_OFFSET = 273.15;

/**
 * Hyland–Wexler coefficients for ln(p_ws), with T in kelvin:
 * ln p_ws = c[0]/T + c[1] + c[2]·T + c[3]·T² + c[4]·T³ + c[5]·T⁴ + c[6]·ln T
 */
const OVER_ICE = [
  -5.6745359e3, 6.3925247, -9.677843e-3, 6.2215701e-7, 2.0747825e-9,
  -9.484024e-13, 4.1635019,
]; // eq. 5, −100 °C to 0.01 °C
const OVER_WATER = [
  -5.8002206e3, 1.3914993, -4.8640239e-2, 4.1764768e-5, -1.4452093e-8, 0,
  6.5459673,
]; // eq. 6, 0.01 °C to 200 °C

/**
 * Pressure of the standard atmosphere at an altitude, in Pa (eq. 3).
 * Valid from −5000 m to 11 000 m.
 */
export function standardAtmosphericPressure(altitudeMeters: number) {
  return STANDARD_SEA_LEVEL_PRESSURE * (1 - 2.25577e-5 * altitudeMeters) ** 5.2559;
}

/**
 * Saturation pressure of water vapour, in Pa (eqs. 5 and 6). Returns NaN
 * outside the formula's range of −100 °C to 200 °C.
 */
export function saturationVaporPressure(temperature: number) {
  if (!(temperature >= -100 && temperature <= 200)) {
    return NaN;
  }
  const c = temperature <= TRIPLE_POINT_OF_WATER ? OVER_ICE : OVER_WATER;
  const t = temperature + ABSOLUTE_ZERO_OFFSET;
  const polynomial = c[1] + t * (c[2] + t * (c[3] + t * (c[4] + t * c[5])));
  return Math.exp(c[0] / t + polynomial + c[6] * Math.log(t));
}

/** Partial pressure of water vapour, in Pa (eq. 22, inverted). */
export function vaporPressure(temperature: number, relativeHumidity: number) {
  return (relativeHumidity / 100) * saturationVaporPressure(temperature);
}

/**
 * Humidity ratio from the partial pressure of water vapour, in g/kg (eq. 20).
 * Returns NaN when the vapour pressure reaches the total pressure.
 */
export function humidityRatioFromVaporPressure(
  vaporPressurePa: number,
  pressure: number
) {
  if (!(vaporPressurePa >= 0 && vaporPressurePa < pressure)) {
    return NaN;
  }
  return (1000 * MOLAR_MASS_RATIO * vaporPressurePa) / (pressure - vaporPressurePa);
}

/** Humidity ratio of air at a temperature and relative humidity, in g/kg. */
export function humidityRatio(
  temperature: number,
  relativeHumidity: number,
  pressure = STANDARD_SEA_LEVEL_PRESSURE
) {
  return humidityRatioFromVaporPressure(
    vaporPressure(temperature, relativeHumidity),
    pressure
  );
}

/** Humidity ratio of saturated air at a temperature, in g/kg (eq. 23). */
export function saturationHumidityRatio(
  temperature: number,
  pressure = STANDARD_SEA_LEVEL_PRESSURE
) {
  return humidityRatio(temperature, 100, pressure);
}

/** Pascals per unit, for the pressure units Home Assistant uses. */
const PASCALS_PER_UNIT: Record<string, number> = {
  pa: 1,
  hpa: 100,
  mbar: 100,
  cbar: 1000,
  kpa: 1000,
  bar: 100000,
  mmhg: 133.322387415,
  inhg: 3386.389,
  psi: 6894.757293168,
};

/**
 * Dew point, in °C: the temperature at which air with this moisture content
 * would be saturated. Found by inverting the saturation vapour pressure
 * (eqs. 5 and 6) with bisection, so it is consistent with the rest of the
 * chart. Returns NaN for dry air or outside −100 °C to 200 °C.
 */
export function dewPoint(temperature: number, relativeHumidity: number) {
  const target = vaporPressure(temperature, relativeHumidity);
  if (!(target > 0)) {
    return NaN;
  }
  if (target >= saturationVaporPressure(temperature)) {
    return temperature;
  }
  let low = -100;
  let high = temperature;
  if (!(target > saturationVaporPressure(low))) {
    return NaN;
  }
  for (let i = 0; i < 50; i++) {
    const middle = (low + high) / 2;
    if (saturationVaporPressure(middle) < target) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
}

/** Converts a temperature from °C to °C, °F or K. */
export function celsiusTo(value: number, unit: string) {
  switch (unit.trim().toUpperCase()) {
    case "°F":
    case "F":
      return 32 + (value * 9) / 5;
    case "K":
      return value + ABSOLUTE_ZERO_OFFSET;
    default:
      return value;
  }
}

/**
 * Converts a temperature reading to °C, from the temperature units Home
 * Assistant uses. Returns undefined for an unknown unit.
 */
export function temperatureToCelsius(value: number, unit: string | undefined) {
  switch ((unit ?? "").trim().toUpperCase()) {
    case "°C":
    case "C":
      return value;
    case "°F":
    case "F":
      return ((value - 32) * 5) / 9;
    case "K":
      return value - ABSOLUTE_ZERO_OFFSET;
    default:
      return undefined;
  }
}

/**
 * Converts a pressure reading to Pa. Returns undefined for an unknown unit.
 */
export function pressureToPascal(value: number, unit: string | undefined) {
  const factor = PASCALS_PER_UNIT[(unit ?? "").trim().toLowerCase()];
  return factor === undefined ? undefined : value * factor;
}
