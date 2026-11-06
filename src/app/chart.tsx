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
import type { Gesture } from "../actions";
import type { Reading } from "../format";
import {
  CHART_CLASS,
  DETAILS_CLASS,
  HUMIDITY_LABELS_CLASS,
  STATUS_CLASS,
} from "./classes";
import { CHART_STYLE } from "./style";
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
  stroke: "var(--_pc-grid)",
  "stroke-width": "1px",
  "stroke-linejoin": "round",
  fill: "none",
} as const;

const comfortZoneStyle = {
  stroke: "var(--_pc-comfort)",
  "stroke-opacity": "0.5",
  "stroke-width": "2px",
  "stroke-linejoin": "round",
  "fill-opacity": "0.3",
  fill: "var(--_pc-comfort)",
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
  stale,
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
  /** The reading is out of date because a sensor is unavailable now. */
  stale?: boolean;
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
          <stop offset="0%" stop-color="var(--_pc-cold)" />
          <stop offset="100%" stop-color="var(--_pc-warm)" />
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
        opacity={stale ? 0.35 : undefined}
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
      {/* At the foot of the line, above the axis labels: its top is where
          the dew point marker lands when the outdoor air is near the dew
          point, which is common in winter. */}
      <text
        {...labelStyle}
        x={percent(clampedX, width)}
        y="100%"
        dx={x < 0 || (!offChart && !anchorEnd) ? 4 : -4}
        dy="-18"
        text-anchor={x < 0 || (!offChart && !anchorEnd) ? "start" : "end"}
      >
        {arrow}
        {outdoor.label}
      </text>
    </g>
  );
}

/** Gives each chart its own gradient id, as cards share the page's DOM. */
let chartCount = 0;

type ChartState = { showDetails: boolean };

/** The readings in the readout. A double tap on one acts on its sensor. */
export type Readout = "temperature" | "humidity";

/** Longest gap between the two taps of a double tap, in ms. */
const DOUBLE_TAP_MS = 250;
/** How long a press must last to count as a hold, as in Home Assistant. */
const HOLD_MS = 500;
/** A press that moves further than this is a scroll, not a hold, in px. */
const HOLD_TOLERANCE = 10;

/** The readout under a pointer event, if any. */
function readoutAt(event: Event): Readout | undefined {
  const element = (event.target as Element | null)?.closest?.("[data-readout]");
  const readout = element?.getAttribute("data-readout");
  return readout === "temperature" || readout === "humidity" ? readout : undefined;
}

export type ChartProps = {
  /** Time-sorted points with finite values, temperatures in °C. */
  history: HistoryPoint[];
  /** The current readings, formatted for the readout. */
  readings?: { temperature: Reading; humidity: Reading };
  /** The unit of the temperature sensor, for the dew point and the axis. */
  temperatureUnit: string;
  /** Formats a number the card computed, such as the dew point. */
  formatNumber?: (value: number) => string;
  /** "Dew point", in the user's language. */
  dewPointName?: string;
  /**
   * A message instead of the trail, such as while the history loads or
   * when there is none.
   */
  status?: string;
  /** Air pressure, in Pa. */
  pressure: number;
  /** Mean outdoor temperature over the last month, in °C. */
  meanOutdoorTemperature?: number;
  /** The current outdoor reading, shown with the other details. */
  outdoor?: OutdoorReading;
  /** Optional card name, shown above the readings. */
  name?: string;
  /** Whether a hold, or a double tap on a reading, does anything. */
  holdEnabled?: boolean;
  doubleTapEnabled?: boolean;
  /** A tooltip for the readings, describing what a double click does. */
  readoutTitle?: string;
  /** Called for a hold anywhere, or a double tap or click on a reading. */
  onGesture?: (gesture: Gesture, readout?: Readout) => void;
};

export default class PsychroChart extends Component<ChartProps, ChartState> {
  private gradientId = `psychro-chart-gradient-${++chartCount}`;
  state: ChartState = { showDetails: false };

  private lastTap: { readout: Readout; time: number } | undefined;
  private pendingToggle: ReturnType<typeof setTimeout> | undefined;
  private lastTouchGesture = -Infinity;
  private holdTimer: ReturnType<typeof setTimeout> | undefined;
  private holdStart: { x: number; y: number } | undefined;
  private held = false;

  private toggleDetails = () => {
    this.pendingToggle = undefined;
    this.setState({ showDetails: !this.state.showDetails });
  };

  private cancelHold = () => {
    clearTimeout(this.holdTimer);
    this.holdTimer = undefined;
    this.holdStart = undefined;
  };

  private onPointerDown = (event: PointerEvent) => {
    this.held = false;
    if (!this.props.holdEnabled || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    const readout = readoutAt(event);
    this.holdStart = { x: event.clientX, y: event.clientY };
    this.holdTimer = setTimeout(() => {
      this.holdTimer = undefined;
      this.held = true;
      clearTimeout(this.pendingToggle);
      this.pendingToggle = undefined;
      this.lastTap = undefined;
      this.props.onGesture?.("hold", readout);
    }, HOLD_MS);
  };

  private onPointerMove = (event: PointerEvent) => {
    const start = this.holdStart;
    if (
      start &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > HOLD_TOLERANCE
    ) {
      this.cancelHold();
    }
  };

  /**
   * A tap on a touch screen toggles the details, as there is no hover. A
   * double tap on a reading runs the double tap action instead, so a tap on
   * a reading waits briefly to see whether a second one follows. A press
   * that became a hold is not a tap.
   */
  private onPointerUp = (event: PointerEvent) => {
    this.cancelHold();
    if (this.held) {
      this.held = false;
      return;
    }
    if (event.pointerType === "mouse") {
      return;
    }
    const readout = this.props.doubleTapEnabled ? readoutAt(event) : undefined;
    const previous = this.lastTap;
    this.lastTap = undefined;
    if (
      readout &&
      previous?.readout === readout &&
      event.timeStamp - previous.time < DOUBLE_TAP_MS
    ) {
      clearTimeout(this.pendingToggle);
      this.pendingToggle = undefined;
      this.lastTouchGesture = event.timeStamp;
      this.props.onGesture?.("double_tap", readout);
      return;
    }
    if (readout) {
      this.lastTap = { readout, time: event.timeStamp };
      clearTimeout(this.pendingToggle);
      this.pendingToggle = setTimeout(this.toggleDetails, DOUBLE_TAP_MS);
    } else {
      this.toggleDetails();
    }
  };

  /** A double click on a reading runs the double tap action. */
  private onDblClick = (event: MouseEvent) => {
    // Some touch browsers also send dblclick after a double tap.
    if (
      !this.props.doubleTapEnabled ||
      event.timeStamp - this.lastTouchGesture < 1000
    ) {
      return;
    }
    const readout = readoutAt(event);
    if (readout) {
      this.props.onGesture?.("double_tap", readout);
    }
  };

  /** Without this, a long press on a touch screen opens the context menu. */
  private onContextMenu = (event: MouseEvent) => {
    if (this.props.holdEnabled) {
      event.preventDefault();
    }
  };

  /** Enter or Space shows or hides the details, like a tap. */
  private onKeyDown = (event: KeyboardEvent) => {
    if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      this.toggleDetails();
    }
  };

  componentWillUnmount() {
    clearTimeout(this.pendingToggle);
    this.cancelHold();
  }

  render() {
    const {
      history,
      readings,
      temperatureUnit: unit,
      pressure,
      meanOutdoorTemperature,
      outdoor,
      status,
    } = this.props;
    const formatNumber = this.props.formatNumber ?? ((value: number) => value.toFixed(1));
    const lastPoint = history[history.length - 1];
    // A reading that is unavailable now: the latest point is out of date.
    const stale = Boolean(
      readings && (!readings.temperature.available || !readings.humidity.available)
    );

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
    const dewPointCelsius =
      lastPoint && !stale ? dewPoint(lastPoint.temperature, lastPoint.humidity) : NaN;
    const dewPointText = Number.isFinite(dewPointCelsius)
      ? `${formatNumber(celsiusTo(dewPointCelsius, unit))} ${unit}`
      : undefined;

    return (
      <div
        class={CHART_CLASS}
        tabIndex={0}
        data-show-details={this.state.showDetails ? "" : undefined}
        onPointerDown={this.onPointerDown}
        onPointerMove={this.onPointerMove}
        onPointerUp={this.onPointerUp}
        onPointerCancel={this.cancelHold}
        onPointerLeave={this.cancelHold}
        onDblClick={this.onDblClick}
        onContextMenu={this.onContextMenu}
        onKeyDown={this.onKeyDown}
        style={{
          height: "100%",
          width: "100%",
          position: "relative",
          padding: 0,
          // Double-clicking a reading acts on its sensor; nothing on the
          // chart is text to select.
          "user-select": "none",
          "-webkit-user-select": "none",
        }}
      >
        <style>{CHART_STYLE}</style>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          // Inline, it would leave a gap below for text descenders, and the
          // latest-point overlay, sized to the container, would not line up.
          style={{ display: "block" }}
          aria-hidden="true"
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
              <stop offset="0%" stop-color="var(--_pc-cold)" />
              <stop offset="100%" stop-color="var(--_pc-warm)" />
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
            stale={stale}
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
        {status ? <div class={STATUS_CLASS}>{status}</div> : null}
        {readings ? (
          <States
            name={this.props.name}
            temperature={readings.temperature}
            humidity={readings.humidity}
            dewPoint={
              dewPointText
                ? `${this.props.dewPointName ?? "Dew point"} ${dewPointText}`
                : undefined
            }
            title={this.props.readoutTitle}
          />
        ) : null}
      </div>
    );
  }
}
