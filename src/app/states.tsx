import { DETAILS_CLASS, READOUT_CLASS } from "./classes";

const TOOLTIP = "Double-click for the sensor's details";

/**
 * The current temperature and humidity, shown over the chart. Its look
 * comes from the stylesheet in `style.ts`.
 */
export default function States({
  name,
  temperature,
  humidity,
  temperatureUnit,
  dewPoint,
}: {
  /** Optional card name, shown above the readings. */
  name?: string;
  temperature: string;
  humidity: string;
  /** The unit `temperature` is in, such as °C or °F. */
  temperatureUnit: string;
  /** Formatted dew point with its unit, shown under the humidity. */
  dewPoint?: string;
}) {
  return (
    <div class={READOUT_CLASS}>
      {name ? (
        <div class={`${READOUT_CLASS}-name`} title={name}>
          {name}
        </div>
      ) : null}
      <div class={`${READOUT_CLASS}-values`}>
        <div
          class={`${READOUT_CLASS}-reading`}
          data-readout="temperature"
          title={TOOLTIP}
        >
          <span class={`${READOUT_CLASS}-value`}>{temperature}</span>
          <span class={`${READOUT_CLASS}-unit`}>{temperatureUnit}</span>
        </div>
        <div
          class={`${READOUT_CLASS}-humidity`}
          data-readout="humidity"
          title={TOOLTIP}
        >
          <div class={`${READOUT_CLASS}-reading`}>
            <span class={`${READOUT_CLASS}-value`}>{humidity}</span>
            <span class={`${READOUT_CLASS}-unit`}>%</span>
          </div>
          {dewPoint ? (
            <span class={`${DETAILS_CLASS} ${READOUT_CLASS}-caption`}>
              Dew point {dewPoint}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
