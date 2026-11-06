import type { Reading } from "../format";
import { DETAILS_CLASS, READOUT_CLASS } from "./classes";

/** A value with its unit, in the order the user's language puts them. */
function ReadingText({ reading }: { reading: Reading }) {
  const unit = reading.unit ? (
    <span class={`${READOUT_CLASS}-unit`}>{reading.unit}</span>
  ) : null;
  return (
    <div class={`${READOUT_CLASS}-reading`}>
      {reading.unitFirst ? unit : null}
      <span class={`${READOUT_CLASS}-value`}>{reading.value}</span>
      {reading.unitFirst ? null : unit}
    </div>
  );
}

/**
 * The current temperature and humidity, shown over the chart. Its look
 * comes from the stylesheet in `style.ts`.
 */
export default function States({
  name,
  temperature,
  humidity,
  dewPoint,
  title,
}: {
  /** Optional card name, shown above the readings. */
  name?: string;
  temperature: Reading;
  humidity: Reading;
  /** The dew point caption under the humidity, such as "Dew point 10.2 °C". */
  dewPoint?: string;
  /** Tooltip for the readings, describing what a double click does. */
  title?: string;
}) {
  return (
    <div class={READOUT_CLASS}>
      {name ? (
        <div class={`${READOUT_CLASS}-name`} title={name}>
          {name}
        </div>
      ) : null}
      <div class={`${READOUT_CLASS}-values`}>
        <div data-readout="temperature" title={title}>
          <ReadingText reading={temperature} />
        </div>
        <div
          class={`${READOUT_CLASS}-humidity`}
          data-readout="humidity"
          title={title}
        >
          <ReadingText reading={humidity} />
          {dewPoint ? (
            <span class={`${DETAILS_CLASS} ${READOUT_CLASS}-caption`}>
              {dewPoint}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
