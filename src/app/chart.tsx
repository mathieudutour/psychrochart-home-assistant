import { getComfortZone, getRelativeHumidity } from "./getComfortZone";
import {
  getSaturationPoint,
  relativeHumidityToAbsoluteHumidity,
} from "./physic";
import States from "./states";

const width = 560;
const height = 184;
const minTemperature = 5;
const maxTemperature = 40;
const minAbsoluteHumidity = 0;
const maxAbsoluteHumidity = 35.001;
const yScale = height / (maxAbsoluteHumidity - minAbsoluteHumidity);
const xScale = width / (maxTemperature - minTemperature);

const humidityLines = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const temperatureLines = Array.from(
  Array(maxTemperature - minTemperature + 1)
).map((_, i) => i + minTemperature);

function temperatureToX(temperature: number) {
  return ((temperature - minTemperature) * xScale).toFixed(1);
}
function absoluteHumidityToY(absoluteHumidity: number) {
  return (
    (maxAbsoluteHumidity - absoluteHumidity - minAbsoluteHumidity) *
    yScale
  ).toFixed(1);
}
function relativeHumidityToY(temperature: number, relativeHumidity: number) {
  return absoluteHumidityToY(
    relativeHumidityToAbsoluteHumidity(temperature, relativeHumidity)
  );
}

function pointsToSVG(points: [number, number][]) {
  return points
    .map(([temperature, absoluteHumidity]) => {
      return {
        x: temperatureToX(temperature),
        y: absoluteHumidityToY(absoluteHumidity),
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
  outdoorTemperature,
}: {
  history: {
    temperature?: string;
    humidity?: string;
    lastChanged: number;
  }[];
  outdoorTemperature?: string;
}) {
  const validHistory = history.filter(
    (x) =>
      x.temperature !== undefined &&
      x.temperature !== "unavailable" &&
      x.humidity !== undefined &&
      x.humidity !== "unavailable"
  );
  const lastPoint = validHistory[validHistory.length - 1];
  const timeDelta = lastPoint
    ? lastPoint.lastChanged - validHistory[0].lastChanged
    : 0;

  const now = new Date();
  let temperature = parseFloat(lastPoint?.temperature ?? "15");
  if (
    Number.isNaN(temperature) ||
    isNaN(temperature) ||
    !isFinite(temperature)
  ) {
    temperature = 15;
  }
  const comfortZone = getComfortZone(
    temperature,
    now.getMonth() <= 4 || now.getMonth() >= 10
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
                  maxTemperature
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
              y2={absoluteHumidityToY(getSaturationPoint(temperature))}
            />
          );
        })}
        <polygon
          {...confortZoneStyle}
          points={pointsToSVG(comfortZone.points)}
        />
        {validHistory.map((x, i, a) => {
          if (i === 0) {
            return null;
          }
          const point = {
            temperature: parseFloat(x.temperature!),
            humidity: parseFloat(x.humidity!),
          };
          const previousPoint = {
            temperature: parseFloat(a[i - 1].temperature!),
            humidity: parseFloat(a[i - 1].humidity!),
          };

          const opacity =
            1 - (lastPoint.lastChanged - x.lastChanged) / timeDelta;

          return (
            <line
              key={opacity}
              {...historyLineStyle}
              strokeOpacity={opacity}
              stroke-opacity={opacity}
              stroke="url(#gradient)"
              x1={temperatureToX(previousPoint.temperature)}
              y1={relativeHumidityToY(
                previousPoint.temperature,
                previousPoint.humidity
              )}
              x2={temperatureToX(point.temperature)}
              y2={relativeHumidityToY(point.temperature, point.humidity)}
            />
          );
        })}
        {lastPoint ? (
          <circle
            cx={temperatureToX(parseFloat(lastPoint.temperature!))}
            cy={relativeHumidityToY(
              parseFloat(lastPoint.temperature!),
              parseFloat(lastPoint.humidity!)
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
          temperature={lastPoint.temperature!}
          humidity={lastPoint.humidity!}
        />
      ) : null}
    </div>
  );
}
