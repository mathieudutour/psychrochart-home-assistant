import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HistoryStore,
  type HistoryStreamMessage,
  type Sample,
  compressedStatesToSamples,
  mergeSamples,
  pairSeries,
  parseNumericState,
  pruneSamples,
  subscribeHistoryStream,
} from "../src/history";

const HOUR = 60 * 60 * 1000;
const T = "sensor.t";
const H = "sensor.h";

const sample = (time: number, value: number): Sample => ({
  time,
  value,
  state: String(value),
});

describe("parseNumericState", () => {
  it("parses numbers", () => {
    assert.equal(parseNumericState("21.5"), 21.5);
    assert.equal(parseNumericState("0"), 0);
    assert.equal(parseNumericState("-3"), -3);
  });

  it("rejects non-numeric states", () => {
    for (const state of ["unknown", "unavailable", "", " ", "12abc", "NaN", undefined, null]) {
      assert.equal(parseNumericState(state), undefined, String(state));
    }
  });
});

describe("compressedStatesToSamples", () => {
  it("drops non-numeric states and converts seconds to milliseconds", () => {
    assert.deepEqual(
      compressedStatesToSamples([
        { s: "20.1", lu: 100 },
        { s: "unknown", lu: 200 },
        { s: "unavailable", lu: 300 },
        { s: "20.4", lu: 400.5 },
      ]),
      [
        { time: 100_000, value: 20.1, state: "20.1" },
        { time: 400_500, value: 20.4, state: "20.4" },
      ]
    );
  });
});

describe("mergeSamples", () => {
  it("appends in-order samples", () => {
    assert.deepEqual(
      mergeSamples([sample(1, 1), sample(2, 2)], [sample(3, 3)]),
      [sample(1, 1), sample(2, 2), sample(3, 3)]
    );
  });

  it("sorts out-of-order samples and keeps one per timestamp", () => {
    assert.deepEqual(
      mergeSamples([sample(1, 1), sample(3, 3)], [sample(2, 2), sample(3, 30)]),
      [sample(1, 1), sample(2, 2), sample(3, 30)]
    );
  });

  it("ignores a replayed message", () => {
    const series = [sample(1, 1), sample(2, 2)];
    assert.deepEqual(mergeSamples(series, series.slice()), series);
  });

  it("returns the same array when there is nothing to merge", () => {
    const series = [sample(1, 1)];
    assert.equal(mergeSamples(series, []), series);
  });
});

describe("pruneSamples", () => {
  it("returns the same array when nothing is old", () => {
    const series = [sample(10, 1), sample(20, 2)];
    assert.equal(pruneSamples(series, 5), series);
  });

  it("keeps the last old sample, moved to the cutoff", () => {
    assert.deepEqual(
      pruneSamples([sample(1, 1), sample(2, 2), sample(20, 3)], 10),
      [sample(10, 2), sample(20, 3)]
    );
  });

  it("does not add a start sample when one sits exactly at the cutoff", () => {
    assert.deepEqual(pruneSamples([sample(1, 1), sample(10, 2)], 10), [
      sample(10, 2),
    ]);
  });

  it("keeps the current value when every sample is old", () => {
    assert.deepEqual(pruneSamples([sample(1, 1), sample(2, 2)], 10), [
      sample(10, 2),
    ]);
  });
});

describe("pairSeries", () => {
  it("carries values forward and waits until both are known", () => {
    assert.deepEqual(
      pairSeries(
        [sample(1, 20), sample(4, 21)],
        [sample(2, 40), sample(3, 41)]
      ),
      [
        { time: 2, temperature: 20, humidity: 40 },
        { time: 3, temperature: 20, humidity: 41 },
        { time: 4, temperature: 21, humidity: 41 },
      ]
    );
  });

  it("makes a single point when both change at the same time", () => {
    assert.deepEqual(pairSeries([sample(5, 20)], [sample(5, 40)]), [
      { time: 5, temperature: 20, humidity: 40 },
    ]);
  });
});

describe("HistoryStore", () => {
  const now = 100 * HOUR;
  const seconds = (ms: number) => ms / 1000;

  it("combines history and live updates, skipping invalid states", () => {
    const store = new HistoryStore({ temperature: T, humidity: H }, 24 * HOUR);
    store.processMessage(
      {
        states: {
          [T]: [
            { s: "20", lu: seconds(now - 2 * HOUR) },
            { s: "unavailable", lu: seconds(now - HOUR) },
          ],
          [H]: [{ s: "40", lu: seconds(now - 2 * HOUR) }],
        },
      },
      now
    );
    store.processMessage({ states: { [T]: [{ s: "21", lu: seconds(now) }] } }, now);
    store.processMessage({ states: { [H]: [{ s: "unknown", lu: seconds(now) }] } }, now);

    assert.deepEqual(store.points(), [
      { time: now - 2 * HOUR, temperature: 20, humidity: 40 },
      { time: now, temperature: 21, humidity: 40 },
    ]);
    assert.deepEqual(store.current(), { temperature: "21", humidity: "40" });
  });

  it("keeps only the window, starting from the value at the window start", () => {
    const store = new HistoryStore({ temperature: T, humidity: H }, 2 * HOUR);
    store.processMessage(
      {
        states: {
          [T]: [
            { s: "18", lu: seconds(now - 5 * HOUR) },
            { s: "19", lu: seconds(now - 3 * HOUR) },
            { s: "20", lu: seconds(now - HOUR) },
          ],
          [H]: [{ s: "50", lu: seconds(now - 4 * HOUR) }],
        },
      },
      now
    );
    assert.deepEqual(store.points(), [
      { time: now - 2 * HOUR, temperature: 19, humidity: 50 },
      { time: now - HOUR, temperature: 20, humidity: 50 },
    ]);

    // Nothing new arrives for three hours: pruning alone moves the window.
    assert.equal(store.prune(now + 3 * HOUR), true);
    assert.deepEqual(store.points(), [
      { time: now + HOUR, temperature: 20, humidity: 50 },
    ]);
    assert.equal(store.prune(now + 3 * HOUR), false);
  });
});

describe("subscribeHistoryStream", () => {
  function fakeConnection() {
    const listeners = new Set<() => void>();
    const subscriptions: {
      message: any;
      options: any;
      callback: (m: HistoryStreamMessage) => void;
      unsubscribed: boolean;
    }[] = [];
    return {
      subscriptions,
      listeners,
      subscribeMessage(callback: any, message: any, options: any) {
        const subscription = { message, options, callback, unsubscribed: false };
        subscriptions.push(subscription);
        return Promise.resolve(async () => {
          subscription.unsubscribed = true;
        });
      },
      addEventListener(_type: string, listener: () => void) {
        listeners.add(listener);
      },
      removeEventListener(_type: string, listener: () => void) {
        listeners.delete(listener);
      },
    };
  }

  it("subscribes to both entities for the window, without auto-resubscribe", () => {
    const connection = fakeConnection();
    const before = Date.now();
    subscribeHistoryStream(connection as any, { temperature: T, humidity: H }, 6, () => {});
    const [{ message, options }] = connection.subscriptions;
    assert.equal(message.type, "history/stream");
    assert.deepEqual(message.entity_ids, [T, H]);
    assert.equal(message.minimal_response, true);
    assert.equal(message.no_attributes, true);
    assert.deepEqual(options, { resubscribe: false });
    const start = new Date(message.start_time).getTime();
    assert.ok(Math.abs(start - (before - 6 * HOUR)) < 1000);
  });

  it("starts a fresh store and subscription when the connection is ready again", () => {
    const connection = fakeConnection();
    const stores: HistoryStore[] = [];
    subscribeHistoryStream(connection as any, { temperature: T, humidity: H }, 6, (store) =>
      stores.push(store)
    );
    const nowSeconds = Date.now() / 1000;
    connection.subscriptions[0].callback({
      states: { [T]: [{ s: "20", lu: nowSeconds }], [H]: [{ s: "40", lu: nowSeconds }] },
    });

    connection.listeners.forEach((listener) => listener());
    assert.equal(connection.subscriptions.length, 2);
    connection.subscriptions[1].callback({
      states: { [T]: [{ s: "21", lu: nowSeconds }], [H]: [{ s: "41", lu: nowSeconds }] },
    });

    assert.notEqual(stores[0], stores[1]);
    assert.equal(stores[1].points().length, 1);
    assert.deepEqual(stores[1].current(), { temperature: "21", humidity: "41" });
  });

  it("stops delivering updates once unsubscribed", async () => {
    const connection = fakeConnection();
    let updates = 0;
    const unsubscribe = subscribeHistoryStream(
      connection as any,
      { temperature: T, humidity: H },
      6,
      () => updates++
    );
    unsubscribe();
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(connection.subscriptions[0].unsubscribed, true);
    assert.equal(connection.listeners.size, 0);
    connection.subscriptions[0].callback({ states: { [T]: [{ s: "20", lu: 1 }] } });
    assert.equal(updates, 0);
  });
});
