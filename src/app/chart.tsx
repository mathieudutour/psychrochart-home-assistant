import { Component } from "preact";
import type { HistoryPoint } from "../history";
import {
  type ChartPoint,
  DEFAULT_MEAN_OUTDOOR_TEMPERATURE,
  getComfortZone,
  getRelativeHumidity,
} from "./getComfortZone";
import {
  celsiusTo,
  dewPoint,
  humidityRatio,
  saturationHumidityRatio,
  temperatureToCelsius,
} from "./physic";
import { CHART_CLASS, DETAILS_CLASS } from "./classes";
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
  dewPointX,
  dewPointLabel,
}: {
  /** Position in chart units. */
  x: number;
  y: number;
  gradientId: string;
  /** Where the blue-to-red gradient starts and ends, in chart units. */
  gradientFrom: number;
  gradientTo: number;
  /**
   * Where the line of constant moisture through the point meets saturation,
   * in chart units. It can be left of the chart, below its lowest
   * temperature.
   */
  dewPointX?: number;
  dewPointLabel?: string;
}) {
  const onChart = dewPointX !== undefined && dewPointX >= 0;
  const lineEnd = dewPointX === undefined ? x : Math.max(0, dewPointX);
  // Near the left edge, put the label right of the marker so it fits.
  const labelRight = !onChart || lineEnd < 0.12 * width;
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
      {dewPointX !== undefined && dewPointLabel ? (
        <g
          class={DETAILS_CLASS}
          stroke="var(--primary-text-color)"
          stroke-opacity="0.6"
          fill="none"
          stroke-width="1.5px"
        >
          <line
            x1={percent(x, width)}
            y1={percent(y, height)}
            x2={percent(lineEnd, width)}
            y2={percent(y, height)}
            stroke-dasharray="3 3"
          />
          {onChart ? (
            <circle cx={percent(lineEnd, width)} cy={percent(y, height)} r={3} />
          ) : null}
          <text
            x={percent(lineEnd, width)}
            y={percent(y, height)}
            dx={labelRight ? (onChart ? 7 : 4) : -7}
            dy="-0.5em"
            text-anchor={labelRight ? "start" : "end"}
            font-size="11px"
            stroke="none"
            fill="var(--secondary-text-color, var(--primary-text-color))"
          >
            {onChart ? dewPointLabel : `← ${dewPointLabel}`}
          </text>
        </g>
      ) : null}
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

/** Text style shared by the overlay's labels. */
const labelStyle = {
  "font-size": "10px",
  fill: "var(--secondary-text-color, var(--primary-text-color))",
} as const;

/** Hidden on narrow charts, where the humidity readout would cover them. */
const HUMIDITY_LABELS_CLASS = "psychro-chart-humidity-labels";

/** Relative humidity curves that get a label, and where (°C). */
const LABELLED_HUMIDITIES = [20, 40, 60, 80, 100];
const HUMIDITY_LABEL_TEMPERATURE = 30;

/**
 * Round temperatures to label along the bottom, in the sensor's unit: every
 * 5 °C or 5 K, or every 10 °F. Returns each label with its position in °C.
 */
export function temperatureTicks(unit: string) {
  const fahrenheit = ["°F", "F"].includes(unit.trim().toUpperCase());
  const kelvin = unit.trim().toUpperCase() === "K";
  const step = fahrenheit ? 10 : 5;
  const from = celsiusTo(minTemperature, unit);
  const to = celsiusTo(maxTemperature, unit);
  const ticks: { label: string; celsius: number }[] = [];
  for (let value = Math.floor(from / step) * step + step; value < to; value += step) {
    ticks.push({
      label: kelvin ? `${value} K` : `${value}°`,
      celsius: temperatureToCelsius(value, unit) ?? value,
    });
  }
  return ticks;
}

export type OutdoorReading = {
  /** °C. */
  temperature: number;
  /** % RH, when an outdoor humidity sensor is configured. */
  humidity?: number;
  /** Text to show, in the sensors' own units. */
  label: string;
};

/**
 * Axis labels and the outdoor reading, in an unstretched overlay like the
 * latest point. The whole overlay only shows on hover or after a tap.
 */
function Details({
  pressure,
  unit,
  outdoor,
}: {
  pressure: number;
  unit: string;
  outdoor?: OutdoorReading;
}) {
  const humidityLabelX = temperatureToX(HUMIDITY_LABEL_TEMPERATURE);
  return (
    <svg
      class={DETAILS_CLASS}
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
      <g {...labelStyle} text-anchor="middle">
        {temperatureTicks(unit).map(({ label, celsius }) => (
          <text key={label} x={percent(temperatureToX(celsius), width)} y="100%" dy="-5">
            {label}
          </text>
        ))}
      </g>
      <g {...labelStyle} class={HUMIDITY_LABELS_CLASS} text-anchor="end">
        {LABELLED_HUMIDITIES.map((rh) => {
          const ratio = humidityRatio(HUMIDITY_LABEL_TEMPERATURE, rh, pressure);
          if (!(ratio <= maxHumidityRatio)) {
            return null;
          }
          return (
            <text
              key={rh}
              x={percent(humidityLabelX, width)}
              y={percent(humidityRatioToY(ratio), height)}
              dx="-4"
              dy="-3"
            >
              {rh}%
            </text>
          );
        })}
      </g>
      {outdoor ? <OutdoorPoint outdoor={outdoor} pressure={pressure} /> : null}
    </svg>
  );
}

/**
 * The outdoor air: a hollow point when its humidity is known, otherwise a
 * dashed line at its temperature. Below the chart, it is shown at the edge.
 */
function OutdoorPoint({
  outdoor,
  pressure,
}: {
  outdoor: OutdoorReading;
  pressure: number;
}) {
  const x = temperatureToX(outdoor.temperature);
  const offChart = x < 0 || x > width;
  const clampedX = Math.min(width, Math.max(0, x));
  const arrow = x < 0 ? "← " : x > width ? "→ " : "";
  const anchorEnd = clampedX > 0.7 * width;
  const stroke = {
    stroke: "var(--primary-text-color)",
    "stroke-opacity": "0.7",
    fill: "none",
  } as const;

  if (outdoor.humidity !== undefined) {
    const y = Math.min(
      height,
      Math.max(0, relativeHumidityToY(outdoor.temperature, outdoor.humidity, pressure))
    );
    return (
      <g>
        {offChart ? null : (
          <circle
            {...stroke}
            stroke-width="2px"
            cx={percent(clampedX, width)}
            cy={percent(y, height)}
            r={4.5}
          />
        )}
        <text
          {...labelStyle}
          x={percent(clampedX, width)}
          y={percent(y, height)}
          dx={anchorEnd ? -9 : offChart ? 4 : 9}
          dy="0.35em"
          text-anchor={anchorEnd ? "end" : "start"}
        >
          {arrow}
          {outdoor.label}
        </text>
      </g>
    );
  }

  const top = humidityRatioToY(
    Math.min(maxHumidityRatio, saturationHumidityRatio(outdoor.temperature, pressure))
  );
  return (
    <g>
      {offChart ? null : (
        <line
          {...stroke}
          stroke-width="1.5px"
          stroke-dasharray="2 4"
          x1={percent(clampedX, width)}
          y1="100%"
          x2={percent(clampedX, width)}
          y2={percent(top, height)}
        />
      )}
      <text
        {...labelStyle}
        x={percent(clampedX, width)}
        y={offChart ? "100%" : percent(top, height)}
        dx={offChart ? (x < 0 ? 4 : -4) : 0}
        dy={offChart ? "-18" : "-5"}
        text-anchor={offChart ? (x < 0 ? "start" : "end") : "middle"}
      >
        {arrow}
        {outdoor.label}
      </text>
    </g>
  );
}

/** Gives each chart its own gradient id, as cards share the page's DOM. */
let chartCount = 0;

/**
 * Details are hidden until the pointer is over the card, or until it is
 * tapped on a touch screen, which has no hover. Touch screens keep :hover
 * after a tap, so the hover rule only applies where hover is real. Cards
 * render into the page's DOM, so the rules are scoped to the chart.
 */
const DETAILS_STYLE = `
.${CHART_CLASS} .${DETAILS_CLASS} {
  opacity: 0;
  transition: opacity 150ms ease-out;
}
.${CHART_CLASS}[data-show-details] .${DETAILS_CLASS} {
  opacity: 1;
}
@media (hover: hover) {
  .${CHART_CLASS}:hover .${DETAILS_CLASS} {
    opacity: 1;
  }
}
.${CHART_CLASS} {
  container-type: inline-size;
}
@container (max-width: 480px) {
  .${HUMIDITY_LABELS_CLASS} {
    display: none;
  }
}
`;

type ChartState = { showDetails: boolean };

export default class PsychroChart extends Component<
  {
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
  /** The current outdoor reading, shown with the other details. */
  outdoor?: OutdoorReading;
  },
  ChartState
> {
  private gradientId = `psychro-chart-gradient-${++chartCount}`;
  state: ChartState = { showDetails: false };

  /** A tap on a touch screen toggles the details, as there is no hover. */
  private onPointerUp = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") {
      this.setState({ showDetails: !this.state.showDetails });
    }
  };

  render() {
    const { history, current, pressure, meanOutdoorTemperature, outdoor } =
      this.props;
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
    const unit = current?.temperatureUnit ?? "°C";
    const dewPointCelsius = lastPoint
      ? dewPoint(lastPoint.temperature, lastPoint.humidity)
      : NaN;
    const dewPointText = Number.isFinite(dewPointCelsius)
      ? `${celsiusTo(dewPointCelsius, unit).toFixed(1)} ${unit}`
      : undefined;

    return (
      <div
        class={CHART_CLASS}
        data-show-details={this.state.showDetails ? "" : undefined}
        onPointerUp={this.onPointerUp}
        style={{
          height: "100%",
          width: "100%",
          position: "relative",
          padding: 0,
        }}
      >
        <style>{DETAILS_STYLE}</style>
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
        <Details pressure={pressure} unit={unit} outdoor={outdoor} />
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
            dewPointX={
              Number.isFinite(dewPointCelsius)
                ? temperatureToX(dewPointCelsius)
                : undefined
            }
            dewPointLabel={dewPointText}
          />
        ) : null}
        {lastPoint ? (
          <States
            temperature={current?.temperature ?? String(lastPoint.temperature)}
            humidity={current?.humidity ?? String(lastPoint.humidity)}
            temperatureUnit={unit}
            dewPoint={dewPointText}
          />
        ) : null}
      </div>
    );
  }
}
