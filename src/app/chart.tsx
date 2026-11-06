import { Component } from "preact";
import type { HistoryPoint } from "../history";
import {
  type ChartPoint,
  DEFAULT_MEAN_OUTDOOR_TEMPERATURE,
  getComfortZone,
  getRelativeHumidity,
} from "./getComfortZone";
import { humidityRatio, saturationHumidityRatio } from "./physic";
import States from "./states";
import { trailPolylines } from "./trail";

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
  return (temperature - minTemperature) * xScale;
}
function humidityRatioToY(ratio: number) {
  return (maxHumidityRatio - ratio - minHumidityRatio) * yScale;
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
    .map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
}

// Presentation attributes. Preact sets props on SVG elements as written, so
// they must use the SVG attribute names.
const gridStyle = {
  stroke: "var(--primary-text-color)",
  "stroke-width": "1px",
  "stroke-linejoin": "round",
  fill: "none",
} as const;

const comfortZoneStyle = {
  stroke: "var(--green)",
  "stroke-opacity": "0.5",
  "stroke-width": "2px",
  "stroke-linejoin": "round",
  "fill-opacity": "0.3",
  fill: "var(--green)",
} as const;

const trailStyle = {
  "stroke-width": "3px",
  "stroke-linejoin": "round",
  "stroke-linecap": "round",
  fill: "none",
} as const;

/**
 * The relative humidity curves and temperature lines. They only depend on
 * the pressure, so they are not rebuilt when new readings arrive.
 */
class Grid extends Component<{ pressure: number }> {
  shouldComponentUpdate(next: { pressure: number }) {
    return next.pressure !== this.props.pressure;
  }

  render({ pressure }: { pressure: number }) {
    return (
      <g {...gridStyle}>
        <g stroke-opacity="0.05">
          {humidityLines.map((relativeHumidity) => (
            <polyline
              key={relativeHumidity}
              points={pointsToSVG(
                getRelativeHumidity(
                  relativeHumidity,
                  minTemperature,
                  maxTemperature,
                  pressure
                )
              )}
            />
          ))}
        </g>
        {temperatureLines.map((temperature) => {
          const x = temperatureToX(temperature).toFixed(1);
          return (
            <line
              key={temperature}
              stroke-opacity={temperature % 5 === 0 ? "0.05" : "0.025"}
              x1={x}
              y1={height}
              x2={x}
              y2={humidityRatioToY(
                saturationHumidityRatio(temperature, pressure)
              ).toFixed(1)}
            />
          );
        })}
      </g>
    );
  }
}

/** Gives each chart its own gradient id, as cards share the page's DOM. */
let chartCount = 0;

export default class PsychroChart extends Component<{
  /** Time-sorted points with finite values, temperatures in °C. */
  history: HistoryPoint[];
  /**
   * The latest readings for the readout, as the sensors report them, with
   * the temperature sensor's unit.
   */
  current?: { temperature: string; humidity: string; temperatureUnit: string };
  /** Air pressure, in Pa. */
  pressure: number;
  /** Mean outdoor temperature over the last month, in °C. */
  meanOutdoorTemperature?: number;
}> {
  private gradientId = `psychro-chart-gradient-${++chartCount}`;

  render() {
    const { history, current, pressure, meanOutdoorTemperature } = this.props;
    const lastPoint = history[history.length - 1];

    const now = new Date();
    const comfortZone = getComfortZone(
      meanOutdoorTemperature ?? DEFAULT_MEAN_OUTDOOR_TEMPERATURE,
      now.getMonth() <= 4 || now.getMonth() >= 10,
      pressure
    );

    const trail = trailPolylines(
      history.map((point) => ({
        x: temperatureToX(point.temperature),
        y: relativeHumidityToY(point.temperature, point.humidity, pressure),
        time: point.time,
      }))
    );
    const gradient = `url(#${this.gradientId})`;

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
              id={this.gradientId}
              gradientUnits="userSpaceOnUse"
              x1={temperatureToX(comfortZone.minComfortTemp).toFixed(1)}
              y1="0"
              x2={temperatureToX(comfortZone.maxComfortTemp).toFixed(1)}
              y2="0"
            >
              <stop offset="0%" stop-color="var(--blue)" />
              <stop offset="100%" stop-color="var(--red)" />
            </linearGradient>
          </defs>
          <Grid pressure={pressure} />
          <polygon {...comfortZoneStyle} points={pointsToSVG(comfortZone.points)} />
          <g {...trailStyle} stroke={gradient}>
            {trail.map(({ opacity, points }, i) => (
              <polyline key={i} stroke-opacity={opacity} points={points} />
            ))}
          </g>
          {lastPoint ? (
            <circle
              cx={temperatureToX(lastPoint.temperature).toFixed(1)}
              cy={relativeHumidityToY(
                lastPoint.temperature,
                lastPoint.humidity,
                pressure
              ).toFixed(1)}
              r={6}
              stroke={gradient}
              stroke-width="3px"
              fill={gradient}
            />
          ) : null}
        </svg>
        {lastPoint ? (
          <States
            temperature={current?.temperature ?? String(lastPoint.temperature)}
            humidity={current?.humidity ?? String(lastPoint.humidity)}
            temperatureUnit={current?.temperatureUnit ?? "°C"}
          />
        ) : null}
      </div>
    );
  }
}
