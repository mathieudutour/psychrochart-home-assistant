// A minimal stand-in for Home Assistant, good enough to drive the card:
// `hass.states` plus a connection that implements `history/stream`.

import type { CompressedState, HistoryStreamMessage } from "../src/history";

export const TEMPERATURE = "sensor.living_room_temperature";
export const HUMIDITY = "sensor.living_room_humidity";
export const OUTDOOR = "sensor.outdoor_temperature";
export const PRESSURE = "sensor.barometric_pressure";

const MINUTE = 60 * 1000;

const SAMPLE_EVERY: Record<string, number> = {
  [TEMPERATURE]: 5 * MINUTE,
  [HUMIDITY]: 7 * MINUTE,
};

/** Deterministic noise in [-1, 1] for a given time bucket and seed. */
function noise(bucket: number, seed: number) {
  const x = Math.sin(bucket * 12.9898 + seed * 78.233) * 43758.5453;
  return 2 * (x - Math.floor(x)) - 1;
}

/** Hour of the local day, 0..24. */
function hourOfDay(time: number) {
  const d = new Date(time);
  return d.getHours() + d.getMinutes() / 60;
}

/** Temperature and humidity as a pure function of time, so a replayed
 * history and the live updates always agree. */
export function simulatedState(entityId: string, time: number): string {
  // Each sensor reports on its own fixed cadence, so its value only changes
  // at those boundaries.
  const step = SAMPLE_EVERY[entityId] ?? 5 * MINUTE;
  const bucket = Math.floor(time / step);
  const h = hourOfDay(bucket * step);
  const day = Math.sin((2 * Math.PI * (h - 9)) / 24);

  if (entityId === TEMPERATURE) {
    // Glitches every 6 hours, so the card's filtering gets exercised.
    if (bucket % 72 === 17) return "unavailable";
    const t = 21.4 + 1.6 * day + 0.15 * noise(bucket, 1);
    return t.toFixed(1);
  }

  if (bucket % 51 === 29) return "unknown";
  // A morning shower bumps humidity around 07:30.
  const shower = 18 * Math.exp(-Math.pow((h - 7.5) / 0.4, 2));
  const rh = 47 - 6 * day + shower + 0.6 * noise(bucket, 2);
  return rh.toFixed(1);
}

/** States of one entity between `start` and `end`, like the recorder would
 * return them: one row per state change, plus the state at `start`. */
function recordedStates(entityId: string, start: number, end: number) {
  const step = SAMPLE_EVERY[entityId] ?? 5 * MINUTE;
  const states: CompressedState[] = [];
  // The state that was current at `start` was set a little before it.
  let time = Math.floor(start / step) * step;
  for (; time <= end; time += step) {
    const s = simulatedState(entityId, time);
    if (states.length && states[states.length - 1].s === s) continue;
    states.push({ s, lu: time / 1000 });
  }
  return states;
}

type Subscription = {
  entityIds: string[];
  callback: (message: HistoryStreamMessage) => void;
};

export class MockConnection {
  private subscriptions = new Set<Subscription>();
  private listeners = new Map<string, Set<() => void>>();
  /** Number of history/stream subscriptions ever opened. */
  subscribeCount = 0;

  async subscribeMessage<T>(
    callback: (message: T) => void,
    message: { type: string; [key: string]: any },
    _options?: { resubscribe?: boolean }
  ): Promise<() => Promise<void>> {
    if (message.type !== "history/stream") {
      throw new Error(`Mock does not support ${message.type}`);
    }
    const start = new Date(message.start_time).getTime();
    if (!(start <= Date.now())) {
      throw { code: "invalid_start_time", message: "Invalid start_time" };
    }
    this.subscribeCount++;
    const subscription: Subscription = {
      entityIds: message.entity_ids,
      callback: callback as Subscription["callback"],
    };
    this.subscriptions.add(subscription);

    // Like Home Assistant: result first, then the history, then live events.
    setTimeout(() => {
      if (!this.subscriptions.has(subscription)) return;
      const end = Date.now();
      const states: HistoryStreamMessage["states"] = {};
      for (const id of subscription.entityIds) {
        states[id] = recordedStates(id, start, end);
      }
      subscription.callback({
        states,
        start_time: start / 1000,
        end_time: end / 1000,
      });
    }, 150);

    return async () => {
      this.subscriptions.delete(subscription);
    };
  }

  /** Sends a live state to every subscription that includes the entity. */
  pushState(entityId: string, state: string, time: number) {
    for (const subscription of this.subscriptions) {
      if (subscription.entityIds.includes(entityId)) {
        subscription.callback({
          states: { [entityId]: [{ s: state, lu: time / 1000 }] },
        });
      }
    }
  }

  /** Drops every subscription, as a lost socket would, then reconnects. */
  simulateReconnect() {
    this.subscriptions.clear();
    this.listeners.get("ready")?.forEach((listener) => listener());
  }

  get activeSubscriptions() {
    return this.subscriptions.size;
  }

  addEventListener(type: string, listener: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }
}

export function createMockHass() {
  const connection = new MockConnection();
  const states: Record<string, any> = {};
  /** 30-day mean of the outdoor sensor, or null when it has no statistics. */
  let outdoorMean: number | null = 19;
  let elevation = 0;
  let statisticsRequests = 0;

  const UNITS: Record<string, string> = {
    [TEMPERATURE]: "°C",
    [HUMIDITY]: "%",
    [OUTDOOR]: "°C",
  };

  const DEVICE_CLASSES: Record<string, string> = {
    [TEMPERATURE]: "temperature",
    [HUMIDITY]: "humidity",
    [OUTDOOR]: "temperature",
    [PRESSURE]: "atmospheric_pressure",
  };
  /** Entity registry: the two indoor sensors share a device. */
  const entities = {
    [TEMPERATURE]: { entity_id: TEMPERATURE, device_id: "living_room_sensor" },
    [HUMIDITY]: { entity_id: HUMIDITY, device_id: "living_room_sensor" },
    [OUTDOOR]: { entity_id: OUTDOOR, device_id: "weather_station" },
  };

  const setState = (
    entityId: string,
    state: string,
    time: number,
    unit = UNITS[entityId]
  ) => {
    const iso = new Date(time).toISOString();
    states[entityId] = {
      entity_id: entityId,
      state,
      attributes: {
        unit_of_measurement: unit,
        device_class: DEVICE_CLASSES[entityId],
      },
      last_changed: iso,
      last_updated: iso,
    };
  };

  const now = Date.now();
  setState(TEMPERATURE, simulatedState(TEMPERATURE, now), now);
  setState(HUMIDITY, simulatedState(HUMIDITY, now), now);
  setState(OUTDOOR, "9.5", now);

  /** Answers the recorder statistics query the card sends. */
  const callWS = async (message: { type: string; [key: string]: any }) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (message.type !== "recorder/statistic_during_period") {
      throw new Error(`Mock does not support ${message.type}`);
    }
    statisticsRequests++;
    return message.statistic_id === OUTDOOR && outdoorMean !== null
      ? { mean: outdoorMean }
      : {};
  };

  const snapshot = () => ({
    states: { ...states },
    entities,
    connection,
    callWS,
    config: { elevation, unit_system: { temperature: "°C" } },
  });

  return {
    connection,
    snapshot,
    /** Moves both sensors to their value at `time` and notifies listeners. */
    tick(time = Date.now()) {
      for (const id of [TEMPERATURE, HUMIDITY]) {
        const state = simulatedState(id, time);
        if (states[id].state !== state) {
          setState(id, state, time);
          connection.pushState(id, state, time);
        }
      }
      return snapshot();
    },
    /** Pushes an arbitrary state, e.g. "unknown", for one entity. */
    push(entityId: string, state: string, time = Date.now()) {
      setState(entityId, state, time);
      connection.pushState(entityId, state, time);
      return snapshot();
    },
    /** Sets the outdoor sensor's 30-day mean, or null for no statistics. */
    setOutdoorMean(mean: number | null) {
      outdoorMean = mean;
    },
    /** Sets the pressure sensor's reading. */
    setPressure(state: string, unit: string) {
      setState(PRESSURE, state, Date.now(), unit);
      return snapshot();
    },
    setElevation(meters: number) {
      elevation = meters;
      return snapshot();
    },
    get statisticsRequests() {
      return statisticsRequests;
    },
  };
}
