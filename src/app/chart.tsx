import type { HistoryPoint } from "../history";
import {
  type ChartPoint,
  DEFAULT_MEAN_OUTDOOR_TEMPERATURE,
  getComfortZone,
  getRelativeHumidity,
} from "./getComfortZone";
import { humidityRatio, saturationHumidityRatio } from "./physic";
import States from "./states";

const width = 560;
const height = 184;
const minTemperature = 5;
const maxTemperature = 40;
const minHumidityRatio = 0;
const maxHumidityRatio = 35.001;
const yScale = height / (maxHumidityRatio - minHumidityRatio);
const xScale = width / (maxTemperature - minTemperature);

const humidityLines = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const temperatureLines = Array.from(
  Array(maxTemperature - minTemperature + 1)
).map((_, i) => i + minTemperature);

function temperatureToX(temperature: number) {
  return ((temperature - minTemperature) * xScale).toFixed(1);
}
function humidityRatioToY(ratio: number) {
  return ((maxHumidityRatio - ratio - minHumidityRatio) * yScale).toFixed(1);
}
function relativeHumidityToY(
  temperature: number,
  relativeHumidity: number,
  pressure: number
) {
  return humidityRatioToY(humidityRatio(temperature, relativeHumidity, pressure));
}

function pointsToSVG(points: ChartPoint[]) {
  return points
    .map(([temperature, ratio]) => {
      return {
        x: temperatureToX(temperature),
        y: humidityRatioToY(ratio),
      };
    })
    .map(({ x, y }) => `${x},${y}`)
    .join(" ");
}

const humidityLineStyle = {
  stroke: "var(--primary-text-color)",
  "stroke-opacity": "0.05",
  strokeOpacity: "0.05",
  strokeWidth: "1px",
  strokeLinejoin: "round",
  "stroke-width": "1px",
  "stroke-line-join": "round",
  fill: "none",
} as const;

const confortZoneStyle = {
  stroke: "var(--green)",
  strokeOpacity: "0.5",
  "stroke-opacity": "0.5",
  strokeWidth: "2px",
  strokeLinejoin: "round",
  "stroke-width": "2px",
  "stroke-line-join": "round",
  fillOpacity: "0.3",
  "fill-opacity": "0.3",
  fill: "var(--green)",
} as const;

const historyLineStyle = {
  stroke: "var(--primary-text-color)",
  "stroke-opacity": "1",
  strokeOpacity: "1",
  strokeWidth: "3px",
  "stroke-width": "3px",
  strokeLinejoin: "round",
  "stroke-line-join": "round",
  fill: "none",
} as const;

export default function PsychroChart({
  history,
  current,
  pressure,
  meanOutdoorTemperature,
}: {
  /** Time-sorted points with finite values. */
  history: HistoryPoint[];
  /** Raw state strings of the latest readings, for the readout. */
  current?: { temperature: string; humidity: string };
  /** Air pressure, in Pa. */
  pressure: number;
  /** Mean outdoor temperature over the last month, in °C. */
  meanOutdoorTemperature?: number;
}) {
  const lastPoint = history[history.length - 1];
  const timeDelta = lastPoint ? lastPoint.time - history[0].time : 0;

  const now = new Date();
  const comfortZone = getComfortZone(
    meanOutdoorTemperature ?? DEFAULT_MEAN_OUTDOOR_TEMPERATURE,
    now.getMonth() <= 4 || now.getMonth() >= 10,
    pressure
  );

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        position: "relative",
        padding: 0,
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient
            id="gradient"
            gradientUnits="userSpaceOnUse"
            x1={temperatureToX(comfortZone.minComfortTemp)}
            y1="0"
            x2={temperatureToX(comfortZone.maxComfortTemp)}
            y2="0"
          >
            <stop offset="0%" stop-color="var(--blue)" />
            <stop offset="100%" stop-color="var(--red)" />
          </linearGradient>
        </defs>
        {humidityLines.map((relativeHumidity) => {
          return (
            <polyline
              key={relativeHumidity}
              {...humidityLineStyle}
              points={pointsToSVG(
                getRelativeHumidity(
                  relativeHumidity,
                  minTemperature,
                  maxTemperature,
                  pressure
                )
              )}
            />
          );
        })}
        {temperatureLines.map((temperature) => {
          return (
            <line
              key={temperature}
              {...humidityLineStyle}
              strokeOpacity={temperature % 5 === 0 ? "0.05" : "0.025"}
              stroke-opacity={temperature % 5 === 0 ? "0.05" : "0.025"}
              x1={temperatureToX(temperature)}
              y1={height}
              x2={temperatureToX(temperature)}
              y2={humidityRatioToY(saturationHumidityRatio(temperature, pressure))}
            />
          );
        })}
        <polygon
          {...confortZoneStyle}
          points={pointsToSVG(comfortZone.points)}
        />
        {history.map((point, i, a) => {
          if (i === 0) {
            return null;
          }
          const previousPoint = a[i - 1];

          const opacity = 1 - (lastPoint.time - point.time) / timeDelta;

          return (
            <line
              key={point.time}
              {...historyLineStyle}
              strokeOpacity={opacity}
              stroke-opacity={opacity}
              stroke="url(#gradient)"
              x1={temperatureToX(previousPoint.temperature)}
              y1={relativeHumidityToY(
                previousPoint.temperature,
                previousPoint.humidity,
                pressure
              )}
              x2={temperatureToX(point.temperature)}
              y2={relativeHumidityToY(point.temperature, point.humidity, pressure)}
            />
          );
        })}
        {lastPoint ? (
          <circle
            cx={temperatureToX(lastPoint.temperature)}
            cy={relativeHumidityToY(
              lastPoint.temperature,
              lastPoint.humidity,
              pressure
            )}
            r={6}
            {...historyLineStyle}
            stroke="url(#gradient)"
            fill="url(#gradient)"
          />
        ) : null}
      </svg>
      {lastPoint ? (
        <States
          temperature={current?.temperature ?? String(lastPoint.temperature)}
          humidity={current?.humidity ?? String(lastPoint.humidity)}
        />
      ) : null}
    </div>
  );
}
