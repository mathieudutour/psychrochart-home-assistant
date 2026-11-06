import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasAction, resolveAction } from "../src/actions";

describe("resolveAction", () => {
  it("opens the reading's sensor on a double tap by default", () => {
    assert.deepEqual(resolveAction({}, "double_tap", "sensor.humidity"), {
      kind: "more-info",
      entityId: "sensor.humidity",
    });
  });

  it("does nothing on a hold by default", () => {
    assert.equal(resolveAction({}, "hold", "sensor.t"), undefined);
    assert.equal(hasAction({}, "hold"), false);
    assert.equal(hasAction({}, "double_tap"), true);
  });

  it("opens another entity's details when the action names one", () => {
    assert.deepEqual(
      resolveAction(
        { hold_action: { action: "more-info", entity: "climate.living_room" } },
        "hold",
        "sensor.t"
      ),
      { kind: "more-info", entityId: "climate.living_room" }
    );
  });

  it("hands other actions to Home Assistant, as built-in cards do", () => {
    const navigate = { action: "navigate", navigation_path: "/lovelace/climate" };
    assert.deepEqual(resolveAction({ hold_action: navigate }, "hold", "sensor.t"), {
      kind: "hass-action",
      detail: {
        config: { entity: "sensor.t", hold_action: navigate },
        action: "hold",
      },
    });
  });

  it("can turn the double tap off", () => {
    const config = { double_tap_action: { action: "none" } };
    assert.equal(resolveAction(config, "double_tap", "sensor.t"), undefined);
    assert.equal(hasAction(config, "double_tap"), false);
  });
});
