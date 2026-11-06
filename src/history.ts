import type {
  Connection,
  MessageBase,
} from "home-assistant-js-websocket";

/** A paired temperature/humidity reading, ready to plot. */
export type HistoryPoint = {
  /** Epoch milliseconds. */
  time: number;
  temperature: number;
  humidity: number;
};

/** A single numeric reading of one entity. */
export type Sample = {
  /** Epoch milliseconds. */
  time: number;
  value: number;
  /** Raw state string, kept for display. */
  state: string;
};

/** Compressed state as sent by Home Assistant's `history/stream`. */
export type CompressedState = {
  /** State. */
  s: string;
  /** Last updated, epoch seconds. */
  lu: number;
  /** Last changed, epoch seconds. Only present when it differs from `lu`. */
  lc?: number;
  a?: Record<string, unknown>;
};

export type HistoryStreamMessage = {
  states: Record<string, CompressedState[]>;
  start_time?: number;
  end_time?: number;
};

export type HistoryEntities = { temperature: string; humidity: string };

type SeriesKey = keyof HistoryEntities;
const SERIES_KEYS: SeriesKey[] = ["temperature", "humidity"];

/**
 * Parses a Home Assistant state into a number. Returns `undefined` for
 * `unknown`, `unavailable`, empty strings and anything else non-numeric.
 */
export function parseNumericState(state: string | undefined | null) {
  if (state == null || state.trim() === "") {
    return undefined;
  }
  const value = Number(state);
  return Number.isFinite(value) ? value : undefined;
}

export function compressedStatesToSamples(
  states: CompressedState[] | undefined
): Sample[] {
  const samples: Sample[] = [];
  for (const state of states ?? []) {
    const value = parseNumericState(state.s);
    if (value !== undefined) {
      samples.push({ time: state.lu * 1000, value, state: state.s });
    }
  }
  return samples;
}

/**
 * Merges new samples into an existing, time-sorted series. The result is
 * sorted by time and has at most one sample per timestamp (the incoming one
 * wins), so replayed or duplicated stream messages are harmless.
 */
export function mergeSamples(existing: Sample[], incoming: Sample[]) {
  if (!incoming.length) {
    return existing;
  }
  const merged = existing.concat(incoming);
  const lastExisting = existing[existing.length - 1];
  const inOrder =
    (!lastExisting || incoming[0].time >= lastExisting.time) &&
    incoming.every((s, i) => i === 0 || s.time >= incoming[i - 1].time);
  if (!inOrder) {
    // Array.prototype.sort is stable, so later (incoming) samples stay after
    // earlier ones with the same timestamp.
    merged.sort((a, b) => a.time - b.time);
  }
  const deduped: Sample[] = [];
  for (const sample of merged) {
    if (deduped.length && deduped[deduped.length - 1].time === sample.time) {
      deduped[deduped.length - 1] = sample;
    } else {
      deduped.push(sample);
    }
  }
  return deduped;
}

/**
 * Drops samples older than `cutoff`. The last sample before the cutoff is
 * kept and moved to the cutoff, because it is still the entity's value at
 * the start of the window. Returns the same array when nothing changed.
 */
export function pruneSamples(samples: Sample[], cutoff: number) {
  if (!samples.length || samples[0].time >= cutoff) {
    return samples;
  }
  let firstKept = samples.findIndex((s) => s.time >= cutoff);
  if (firstKept === -1) {
    firstKept = samples.length;
  }
  const kept = samples.slice(firstKept);
  if (kept.length && kept[0].time === cutoff) {
    return kept;
  }
  return [{ ...samples[firstKept - 1], time: cutoff }, ...kept];
}

/**
 * Combines two independent series into points that have both values, by
 * carrying each series' last value forward until it changes.
 */
export function pairSeries(temperature: Sample[], humidity: Sample[]) {
  const points: HistoryPoint[] = [];
  let i = 0;
  let j = 0;
  let currentTemperature: number | undefined;
  let currentHumidity: number | undefined;

  while (i < temperature.length || j < humidity.length) {
    const time = Math.min(
      temperature[i]?.time ?? Infinity,
      humidity[j]?.time ?? Infinity
    );
    while (i < temperature.length && temperature[i].time === time) {
      currentTemperature = temperature[i++].value;
    }
    while (j < humidity.length && humidity[j].time === time) {
      currentHumidity = humidity[j++].value;
    }
    if (currentTemperature !== undefined && currentHumidity !== undefined) {
      points.push({
        time,
        temperature: currentTemperature,
        humidity: currentHumidity,
      });
    }
  }
  return points;
}

/** Holds the temperature and humidity history of one stream subscription. */
export class HistoryStore {
  private series: Record<SeriesKey, Sample[]> = {
    temperature: [],
    humidity: [],
  };
  private cachedPoints: HistoryPoint[] | undefined;

  constructor(
    readonly entities: HistoryEntities,
    readonly windowMs: number
  ) {}

  processMessage(message: HistoryStreamMessage, now = Date.now()) {
    for (const key of SERIES_KEYS) {
      const incoming = compressedStatesToSamples(
        message.states?.[this.entities[key]]
      );
      if (incoming.length) {
        this.series[key] = mergeSamples(this.series[key], incoming);
        this.cachedPoints = undefined;
      }
    }
    this.prune(now);
  }

  /** Drops samples that fell out of the window. Returns true if any did. */
  prune(now = Date.now()) {
    const cutoff = now - this.windowMs;
    let changed = false;
    for (const key of SERIES_KEYS) {
      const pruned = pruneSamples(this.series[key], cutoff);
      if (pruned !== this.series[key]) {
        this.series[key] = pruned;
        changed = true;
      }
    }
    if (changed) {
      this.cachedPoints = undefined;
    }
    return changed;
  }

  points() {
    if (!this.cachedPoints) {
      this.cachedPoints = pairSeries(
        this.series.temperature,
        this.series.humidity
      );
    }
    return this.cachedPoints;
  }

  /** Raw state strings of the latest valid readings, for display. */
  current() {
    const temperature = this.series.temperature[this.series.temperature.length - 1];
    const humidity = this.series.humidity[this.series.humidity.length - 1];
    return temperature && humidity
      ? { temperature: temperature.state, humidity: humidity.state }
      : undefined;
  }
}

type StreamConnection = Pick<
  Connection,
  "subscribeMessage" | "addEventListener" | "removeEventListener"
>;

/**
 * Subscribes to `history/stream` for both entities. Home Assistant first
 * sends the history for the window, then pushes every new state.
 *
 * Like the Home Assistant frontend, this does not use the websocket library's
 * auto-resubscribe: that would replay the original, now stale, start time.
 * Instead each reconnect starts a fresh store and a fresh subscription.
 *
 * Returns a function that ends the subscription.
 */
export function subscribeHistoryStream(
  connection: StreamConnection,
  entities: HistoryEntities,
  hours: number,
  onUpdate: (store: HistoryStore) => void
) {
  const windowMs = hours * 60 * 60 * 1000;
  let disposed = false;
  let currentUnsubscribe: Promise<() => Promise<void>> | undefined;

  const subscribe = () => {
    const store = new HistoryStore(entities, windowMs);
    const message: MessageBase = {
      type: "history/stream",
      entity_ids: Array.from(
        new Set([entities.temperature, entities.humidity])
      ),
      start_time: new Date(Date.now() - windowMs).toISOString(),
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: true,
    };
    const unsubscribe = connection.subscribeMessage<HistoryStreamMessage>(
      (streamMessage) => {
        if (disposed) {
          return;
        }
        store.processMessage(streamMessage);
        onUpdate(store);
      },
      message,
      { resubscribe: false }
    );
    unsubscribe.catch((error) => {
      console.error("psychro-chart-card: history subscription failed", error);
    });
    currentUnsubscribe = unsubscribe;
  };

  const onReady = () => {
    if (!disposed) {
      // The previous subscription died with the old socket.
      currentUnsubscribe = undefined;
      subscribe();
    }
  };

  subscribe();
  connection.addEventListener("ready", onReady);

  return () => {
    disposed = true;
    connection.removeEventListener("ready", onReady);
    currentUnsubscribe
      ?.then((unsubscribe) => unsubscribe())
      .catch(() => undefined);
    currentUnsubscribe = undefined;
  };
}
