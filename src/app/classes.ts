// CSS class names shared by the chart, the readout and the stylesheet.
// Cards render into the page's DOM, so they are prefixed to avoid clashing
// with other cards.

export const CHART_CLASS = "psychro-chart";
/**
 * Details that only show while hovering or after a tap: the dew point,
 * the axis labels and the outdoor reading.
 */
export const DETAILS_CLASS = "psychro-chart-details";
/** Hidden on narrow charts, where the humidity readout would cover them. */
export const HUMIDITY_LABELS_CLASS = "psychro-chart-humidity-labels";
/** A message over the chart, such as while the history loads. */
export const STATUS_CLASS = "psychro-chart-status";
/** The temperature and humidity readout; its parts add a suffix. */
export const READOUT_CLASS = "psychro-chart-readout";
