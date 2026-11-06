/** The current temperature and humidity, shown over the chart. */
export default function States({
  temperature,
  humidity,
  temperatureUnit,
  dewPoint,
}: {
  temperature: string;
  humidity: string;
  /** The unit `temperature` is in, such as °C or °F. */
  temperatureUnit: string;
  /** Formatted dew point with its unit, shown under the humidity. */
  dewPoint?: string;
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
          {temperatureUnit}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          "flex-direction": "column",
          "align-items": "flex-end",
          "min-width": "0px",
          "margin-left": "1.4em",
        }}
      >
        <div
          style={{
            display: "flex",
            "flex-flow": "row",
            "align-items": "flex-end",
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
        {dewPoint ? (
          <span
            style={{
              "font-size": "0.85em",
              opacity: "0.6",
              "white-space": "nowrap",
            }}
          >
            Dew point {dewPoint}
          </span>
        ) : null}
      </div>
    </div>
  );
}
