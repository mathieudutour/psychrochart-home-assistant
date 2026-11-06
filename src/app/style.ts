import {
  CHART_CLASS,
  DETAILS_CLASS,
  HUMIDITY_LABELS_CLASS,
  READOUT_CLASS,
} from "./classes";

/**
 * The card's stylesheet. Cards render into the page's DOM, so every rule is
 * scoped to the chart's class.
 *
 * The look follows Home Assistant's own cards, using the variables every
 * theme sets. Each choice can be changed with a `--psychrochart-*` variable,
 * set in a theme or with card-mod. The `--_pc-*` variables are internal:
 * they hold the resolved value of each public one.
 */
export const CHART_STYLE = `
.${CHART_CLASS} {
  --_pc-comfort: var(--psychrochart-comfort-zone-color, var(--green-color, #4caf50));
  --_pc-cold: var(--psychrochart-cold-color, var(--blue-color, #2196f3));
  --_pc-warm: var(--psychrochart-warm-color, var(--red-color, #f44336));
  --_pc-grid: var(--psychrochart-grid-color, var(--primary-text-color));
  --_pc-unit: var(--psychrochart-unit-color, var(--secondary-text-color));
  container-type: inline-size;
}

/* The temperature and humidity readout, over the top of the chart. */
.${READOUT_CLASS} {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  box-sizing: border-box;
  padding: var(--psychrochart-readout-padding, 16px 16px 0);
  line-height: var(--ha-line-height-condensed, 1.2);
  color: var(--primary-text-color);
}
.${READOUT_CLASS}-name {
  margin-bottom: 4px;
  color: var(--secondary-text-color);
  font-size: var(--psychrochart-name-font-size, var(--ha-font-size-l, 16px));
  font-weight: var(--ha-font-weight-medium, 500);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.${READOUT_CLASS}-values {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
.${READOUT_CLASS}-humidity {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 0;
}
.${READOUT_CLASS}-reading {
  display: flex;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
}
.${READOUT_CLASS}-value {
  font-size: var(--psychrochart-value-font-size, var(--ha-font-size-3xl, 28px));
  font-weight: var(--psychrochart-value-font-weight, var(--ha-font-weight-normal, 400));
}
.${READOUT_CLASS}-unit {
  font-size: var(--psychrochart-unit-font-size, var(--ha-font-size-l, 16px));
  color: var(--_pc-unit);
}
.${READOUT_CLASS}-caption {
  font-size: var(--ha-font-size-s, 12px);
  color: var(--_pc-unit);
  white-space: nowrap;
}

/*
 * Details are hidden until the pointer is over the card, or until it is
 * tapped on a touch screen, which has no hover. Touch screens keep :hover
 * after a tap, so the hover rule only applies where hover is real.
 */
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

/* The humidity readout covers the humidity labels on narrow charts. */
@container (max-width: 480px) {
  .${HUMIDITY_LABELS_CLASS} {
    display: none;
  }
}
`;
