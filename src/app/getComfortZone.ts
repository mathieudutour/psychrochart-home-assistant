import { mapAndClamp, snapTo } from "./geometry";
import { relativeHumidityToAbsoluteHumidity } from "./physic";

function constantRelativeHumidityCurve(
  relativeHumidity: number,
  temperatureA: number,
  temperatureB: number,
  absoluteHumidityLimit: number = 9999
) {
  const points: [number, number][] = [];
  const temperatureDelta = temperatureB - temperatureA;

  let absoluteHumidity = relativeHumidityToAbsoluteHumidity(
    temperatureA,
    relativeHumidity
  );

  var h = 1 / Math.max(6, Math.round(Math.abs(temperatureDelta))),
    m = 1 + 0.5 * h;

  let temperature = temperatureA;

  for (let f = h; f < m; f += h) {
    const newTemperature = temperatureA + f * temperatureDelta;
    let newAbsoluteHumidity = relativeHumidityToAbsoluteHumidity(
      newTemperature,
      relativeHumidity
    );

    if (newAbsoluteHumidity > absoluteHumidityLimit) {
      if (absoluteHumidity < absoluteHumidityLimit - 0.001) {
        points.push([
          mapAndClamp(
            absoluteHumidityLimit,
            absoluteHumidity,
            newAbsoluteHumidity,
            temperature,
            newTemperature
          ),
          absoluteHumidityLimit,
        ]);
      }
      newAbsoluteHumidity = absoluteHumidityLimit;
    }

    points.push([newTemperature, newAbsoluteHumidity]);

    temperature = newTemperature;
    absoluteHumidity = newAbsoluteHumidity;
  }

  absoluteHumidity = relativeHumidityToAbsoluteHumidity(
    temperatureB,
    relativeHumidity
  );

  return points;
}

export function getComfortZone(meanOutdoorTemperature = 20, winter = false) {
  const minComfortTemp = snapTo(
    17.6 + 0.31 * meanOutdoorTemperature - 3.5 + (winter ? -2 : 0),
    0.1
  );
  const maxComfortTemp = minComfortTemp + (winter ? 9 : 7);

  const points: [number, number][] = [];
  points.push([
    maxComfortTemp,
    relativeHumidityToAbsoluteHumidity(maxComfortTemp, 50),
  ]);
  points.push([
    maxComfortTemp,
    relativeHumidityToAbsoluteHumidity(maxComfortTemp, 20),
  ]);
  points.push(
    ...constantRelativeHumidityCurve(20, maxComfortTemp, minComfortTemp)
  );
  points.push([
    minComfortTemp,
    relativeHumidityToAbsoluteHumidity(minComfortTemp, 20),
  ]);
  points.push([
    minComfortTemp,
    relativeHumidityToAbsoluteHumidity(minComfortTemp, 80),
  ]);
  points.push(
    ...constantRelativeHumidityCurve(
      80,
      minComfortTemp,
      minComfortTemp + (winter ? 7 : 5),
      16
    )
  );

  return { minComfortTemp, maxComfortTemp, points };
}

export function getRelativeHumidity(
  relativeHumidity: number,
  minTemperature: number,
  maxTemperature: number
) {
  const points: [number, number][] = [];
  points.push([
    minTemperature,
    relativeHumidityToAbsoluteHumidity(minTemperature, relativeHumidity),
  ]);
  points.push(
    ...constantRelativeHumidityCurve(
      relativeHumidity,
      minTemperature,
      maxTemperature
    )
  );
  points.push([
    maxTemperature,
    relativeHumidityToAbsoluteHumidity(maxTemperature, relativeHumidity),
  ]);

  return points;
}
