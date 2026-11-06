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

/**
 * The chart stretches to fill the card, so without this a stroke would be
 * thicker in the direction the card is stretched. It is not inherited, so
 * each shape needs it.
 */
const NON_SCALING = { "vector-effect": "non-scaling-stroke" } as const;

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
              {...NON_SCALING}
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
              {...NON_SCALING}
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

/** Formats a chart coordinate as a percentage of the chart's size. */
function percent(value: number, total: number) {
  return `${((100 * value) / total).toFixed(2)}%`;
}

/**
 * The latest reading, drawn in its own SVG over the chart. That SVG has no
 * viewBox, so it is not stretched with the chart: the dot is positioned in
 * percentages of the chart but sized in pixels, and stays round.
 */
function LatestPoint({
  x,
  y,
  gradientId,
  gradientFrom,
  gradientTo,
}: {
  /** Position in chart units. */
  x: number;
  y: number;
  gradientId: string;
  /** Where the blue-to-red gradient starts and ends, in chart units. */
  gradientFrom: number;
  gradientTo: number;
}) {
  return (
    <svg
      width="100%"
      height="100%"
      style={{
        position: "absolute",
        top: "0",
        left: "0",
        overflow: "visible",
        "pointer-events": "none",
      }}
    >
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={percent(gradientFrom, width)}
          y1="0"
          x2={percent(gradientTo, width)}
          y2="0"
        >
          <stop offset="0%" stop-color="var(--blue)" />
          <stop offset="100%" stop-color="var(--red)" />
        </linearGradient>
      </defs>
      <circle
        cx={percent(x, width)}
        cy={percent(y, height)}
        r={6}
        stroke={`url(#${gradientId})`}
        stroke-width="3px"
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
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
          // Inline, it would leave a gap below for text descenders, and the
          // latest-point overlay, sized to the container, would not line up.
          style={{ display: "block" }}
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
          <polygon
            {...comfortZoneStyle}
            {...NON_SCALING}
            points={pointsToSVG(comfortZone.points)}
          />
          <g {...trailStyle} stroke={gradient}>
            {trail.map(({ opacity, points }, i) => (
              <polyline
                key={i}
                {...NON_SCALING}
                stroke-opacity={opacity}
                points={points}
              />
            ))}
          </g>
        </svg>
        {lastPoint ? (
          <LatestPoint
            x={temperatureToX(lastPoint.temperature)}
            y={relativeHumidityToY(
              lastPoint.temperature,
              lastPoint.humidity,
              pressure
            )}
            gradientId={`${this.gradientId}-point`}
            gradientFrom={temperatureToX(comfortZone.minComfortTemp)}
            gradientTo={temperatureToX(comfortZone.maxComfortTemp)}
          />
        ) : null}
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
