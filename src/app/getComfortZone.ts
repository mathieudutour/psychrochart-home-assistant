import { snapTo } from "./geometry";
import { humidityRatio } from "./physic";

/** A chart point: dry-bulb temperature (°C) and humidity ratio (g/kg). */
export type ChartPoint = [temperature: number, humidityRatio: number];

/**
 * Mean outdoor temperature (°C) assumed when none is known. Matches the
 * default of Andrew Marsh's psychrometric chart.
 */
export const DEFAULT_MEAN_OUTDOOR_TEMPERATURE = 19;

/** The comfort zone's upper humidity limit, in g/kg. */
const MAX_COMFORT_HUMIDITY_RATIO = 16;

/**
 * The temperature between `a` and `b` at which the constant relative
 * humidity line reaches `target` g/kg, found by bisection.
 */
function crossingTemperature(
  relativeHumidity: number,
  a: number,
  b: number,
  pressure: number,
  target: number
) {
  const rising =
    humidityRatio(b, relativeHumidity, pressure) >
    humidityRatio(a, relativeHumidity, pressure);
  for (let i = 0; i < 40; i++) {
    const middle = (a + b) / 2;
    const above = humidityRatio(middle, relativeHumidity, pressure) > target;
    if (above === rising) {
      b = middle;
    } else {
      a = middle;
    }
  }
  return (a + b) / 2;
}

/**
 * Points along a line of constant relative humidity, from one temperature to
 * another, both ends included. Where the line rises above
 * `maxHumidityRatio`, it is clipped to that value.
 */
export function relativeHumidityCurve(
  relativeHumidity: number,
  fromTemperature: number,
  toTemperature: number,
  pressure: number,
  maxHumidityRatio = Infinity
) {
  const steps = Math.max(6, Math.round(Math.abs(toTemperature - fromTemperature)));
  const points: ChartPoint[] = [];
  let previous: ChartPoint | undefined;

  for (let i = 0; i <= steps; i++) {
    const temperature =
      fromTemperature + (i / steps) * (toTemperature - fromTemperature);
    const ratio = humidityRatio(temperature, relativeHumidity, pressure);

    // Add the point where the curve crosses the limit.
    if (
      previous &&
      previous[1] <= maxHumidityRatio !== ratio <= maxHumidityRatio
    ) {
      points.push([
        crossingTemperature(
          relativeHumidity,
          previous[0],
          temperature,
          pressure,
          maxHumidityRatio
        ),
        maxHumidityRatio,
      ]);
    }
    points.push([temperature, Math.min(ratio, maxHumidityRatio)]);
    previous = [temperature, ratio];
  }
  return points;
}

/**
 * The comfort zone of the Givoni bioclimatic chart, as drawn by Andrew
 * Marsh's psychrometric chart. The lower temperature limit is Auliciems'
 * neutral temperature (17.6 + 0.31 × mean outdoor temperature) less the
 * 3.5 °C half-width of the 80% acceptability band. Humidity is bounded by
 * 20% and 80% relative humidity and by 16 g/kg, and the warmest part of the
 * zone by 50% relative humidity.
 *
 * In winter the zone extends 2 °C lower and 2 °C further along the 80% line.
 */
export function getComfortZone(
  meanOutdoorTemperature: number,
  winter: boolean,
  pressure: number
) {
  const minComfortTemp = snapTo(
    17.6 + 0.31 * meanOutdoorTemperature - 3.5 + (winter ? -2 : 0),
    0.1
  );
  const maxComfortTemp = minComfortTemp + (winter ? 9 : 7);

  const points: ChartPoint[] = [
    [
      maxComfortTemp,
      Math.min(
        MAX_COMFORT_HUMIDITY_RATIO,
        humidityRatio(maxComfortTemp, 50, pressure)
      ),
    ],
    ...relativeHumidityCurve(20, maxComfortTemp, minComfortTemp, pressure),
    ...relativeHumidityCurve(
      80,
      minComfortTemp,
      minComfortTemp + (winter ? 7 : 5),
      pressure,
      MAX_COMFORT_HUMIDITY_RATIO
    ),
  ];

  return { minComfortTemp, maxComfortTemp, points };
}

/** A relative humidity guide line across the chart. */
export function getRelativeHumidity(
  relativeHumidity: number,
  minTemperature: number,
  maxTemperature: number,
  pressure: number
) {
  return relativeHumidityCurve(
    relativeHumidity,
    minTemperature,
    maxTemperature,
    pressure
  );
}
