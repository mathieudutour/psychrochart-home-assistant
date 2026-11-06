/** The current temperature and humidity, shown over the chart. */
export default function States({
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
