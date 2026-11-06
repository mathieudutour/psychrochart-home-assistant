
const width = 640;
const height = 480;
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
  strokeWidth: "2px",
  strokeLinejoin: "round",
  "stroke-width": "2px",
  "stroke-line-join": "round",
  fill: "none",
} as const;

const confortZoneStyle = {
  stroke: "var(--green)",
  strokeOpacity: "0.3",
  "stroke-opacity": "0.3",
  strokeWidth: "1px",
  strokeLinejoin: "round",
  "stroke-width": "1px",
  "stroke-line-join": "round",
  fillOpacity: "0.2",
  "fill-opacity": "0.2",
  fill: "var(--green)",
} as const;

const historyLineStyle = {
  stroke: "var(--primary-text-color)",
  "stroke-opacity": "1",
  strokeOpacity: "1",
  strokeWidth: "1px",
  strokeLinejoin: "round",
  "stroke-width": "1px",
  "stroke-line-join": "round",
  fill: "none",
} as const;

export default function PsychroChart({
  temperature,
  humidity,
}: {
  temperature: string;
  humidity: string;
}) {
  return (
    <div
      style={{
        "align-items": "flex-start",
        "font-weight": "300",
        "justify-content": "space-between",
        "flex-wrap": "nowrap",
        position: "absolute",
        top: "0",
        width: "100%",
        display: "flex",
        "margin-top": "1em",
        padding: "0px 16px 16px",
        "box-sizing": "border-box",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          "flex-wrap": "nowrap",
          "max-width": "100%",
          "min-width": "0px",
        }}
      >
        <span
          style={{
            display: "inline-block",
            "font-size": "2.4em",
            "margin-right": "0.25rem",
            "line-height": "1.2em",
          }}
        >
          {temperature}
        </span>
        <span
          style={{
            flex: "1 1 0%",
            "align-self": "flex-end",
            display: "inline-block",
            "font-size": "1.4em",
            "font-weight": "400",
            "line-height": "1.6em",
            "margin-top": "0.1em",
            opacity: "0.6",
            "vertical-align": "bottom",
          }}
        >
          °C
        </span>
      </div>

      <div
        style={{
          display: "flex",
          "flex-flow": "row",
          "align-items": "flex-end",
          "min-width": "0px",
          "margin-left": "1.4em",
        }}
      >
        <span
          style={{
            display: "inline-block",
            "font-size": "2.4em",
            "margin-right": "0.25rem",
            "line-height": "1.2em",
          }}
        >
          {humidity}
        </span>
        <span
          style={{
            flex: "1 1 0%",
            "align-self": "flex-end",
            display: "inline-block",
            "font-size": "1.4em",
            "font-weight": "400",
            "line-height": "1.6em",
            "margin-top": "0.1em",
            opacity: "0.6",
            "vertical-align": "bottom",
          }}
        >
          %
        </span>
      </div>
    </div>
  );
}
