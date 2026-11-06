// Hold and double tap actions, configured like the built-in cards'
// `hold_action` and `double_tap_action`. A single tap is kept for showing
// the details on touch screens, so `tap_action` is not offered.

/** An action as Home Assistant's `ui_action` selector writes it. */
export type ActionConfig = {
  action: string;
  entity?: string;
  [key: string]: unknown;
};

export type CardActions = {
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
};

export type Gesture = "hold" | "double_tap";

/** A double tap on a reading opens its sensor, unless configured otherwise. */
export const DEFAULT_DOUBLE_TAP_ACTION: ActionConfig = { action: "more-info" };

export type ResolvedAction =
  | { kind: "more-info"; entityId: string }
  | {
      kind: "hass-action";
      detail: { config: Record<string, unknown>; action: Gesture };
    };

export function actionFor(config: CardActions, gesture: Gesture) {
  return gesture === "hold"
    ? config.hold_action
    : config.double_tap_action ?? DEFAULT_DOUBLE_TAP_ACTION;
}

/** Whether a gesture does anything, so the card only listens for it then. */
export function hasAction(config: CardActions, gesture: Gesture) {
  const action = actionFor(config, gesture);
  return Boolean(action && action.action !== "none");
}

/**
 * What a gesture should do. `entityId` is the sensor it was made on: the
 * reading under the pointer, or the temperature sensor elsewhere.
 *
 * More-info is opened directly with `hass-more-info`, which every Home
 * Assistant version handles. Other actions are handed to Home Assistant
 * with `hass-action`, the event built-in cards use, so every action type,
 * and its confirmation, works as it does there.
 */
export function resolveAction(
  config: CardActions,
  gesture: Gesture,
  entityId: string
): ResolvedAction | undefined {
  const action = actionFor(config, gesture);
  if (!action || action.action === "none") {
    return undefined;
  }
  if (action.action === "more-info") {
    return { kind: "more-info", entityId: action.entity ?? entityId };
  }
  return {
    kind: "hass-action",
    detail: {
      config: { entity: entityId, [`${gesture}_action`]: action },
      action: gesture,
    },
  };
}
