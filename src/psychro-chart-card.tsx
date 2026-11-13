import { HomeAssistant } from "custom-card-helpers";
import { render } from "preact";
import {
  type ActionConfig,
  type Gesture,
  actionFor,
  hasAction,
  resolveAction,
} from "./actions";
import Card from "./app/chart";
import {
  fetchMeanOutdoorTemperature,
  pointsInCelsius,
  resolvePressure,
  temperatureUnit,
} from "./environment";
import type { OutdoorReading, Readout } from "./app/chart";
import { temperatureToCelsius } from "./app/physic";
import { type Reading, formatNumber, formatReading, localize } from "./format";
import { parseNumericState } from "./history";
import { type StringKey, languageOf, translate } from "./translations";
import { type HistoryPoint, HistoryStore, subscribeHistoryStream } from "./history";
import {
  CARD_TYPE,
  type PickerHass,
  configForm,
  entitySuggestion,
  stubConfig,
} from "./setup";

/** Replaced with the package version at build time. */
declare const __CARD_VERSION__: string;
const VERSION = typeof __CARD_VERSION__ === "string" ? __CARD_VERSION__ : "dev";
const DOCUMENTATION_URL =
  "https://github.com/mathieudutour/psychrochart-home-assistant#readme";

type CardConfig = {
  /** Shown above the readings, like the name of built-in cards. */
  name?: string;
  temperature: string;
  humidity: string;
  /** Outdoor temperature sensor; its monthly mean sets the comfort zone. */
  outdoorTemperature?: string;
  /** Outdoor humidity sensor; with the temperature, plots the outdoor air. */
  outdoorHumidity?: string;
  /** Barometric pressure sensor. Defaults to the pressure at the elevation. */
  pressure?: string;
  hours?: number;
  /** On a reading; by default, opens its sensor's details. */
  double_tap_action?: ActionConfig;
  /** Anywhere on the card; by default, nothing. */
  hold_action?: ActionConfig;
};

/** What `hass` must provide for the readings to be formatted. */
type FormattingHass = HomeAssistant & {
  formatEntityStateToParts?: (stateObj: any) => { type: string; value: string }[];
  formatEntityState?: (stateObj: any) => string;
  entities?: Record<string, unknown>;
};

const DEFAULT_HOURS = 24;
/** How often old points are dropped when no new state arrives. */
const PRUNE_INTERVAL_MS = 60 * 1000;
/** How often the monthly mean outdoor temperature is refreshed. */
const MEAN_OUTDOOR_REFRESH_MS = 60 * 60 * 1000;

class PsychroChartCard extends HTMLElement {
  /** The visual editor's form. */
  static getConfigForm() {
    return configForm();
  }

  /** The starting config when the card is added from the card picker. */
  static getStubConfig(hass?: PickerHass) {
    return stubConfig(hass);
  }

  private _config: CardConfig | undefined;
  private _hass: HomeAssistant | undefined;
  private _store: HistoryStore | undefined;

  private _unsubscribe: (() => void) | undefined;
  private _subscriptionKey: string | undefined;
  private _subscriptionConnection: HomeAssistant["connection"] | undefined;
  private _pruneTimer: ReturnType<typeof setInterval> | undefined;
  private _renderedPressure: number | undefined;
  private _renderedUnit: string | undefined;
  private _renderedOutdoorKey: string | undefined;
  /** What the last render read from `hass`, to skip renders that change
   * nothing. States and registry entries are replaced when they change. */
  private _renderedInputs: unknown[] = [];
  /** Points converted to °C, cached for the points and unit they came from. */
  private _celsiusPoints:
    | { source: HistoryPoint[]; unit: string; points: HistoryPoint[] }
    | undefined;

  private _meanOutdoorTemperature: number | undefined;
  /** The entity, and time, of the latest mean outdoor temperature request. */
  private _meanOutdoorEntity: string | undefined;
  private _meanOutdoorRequestedAt = 0;
  private _meanOutdoorRequest = 0;
  private _warnedNoStatistics = new Set<string>();

  set hass(hass: HomeAssistant | undefined) {
    const firstHass = !this._hass;
    this._hass = hass;
    this._ensureSubscription();
    this._refreshMeanOutdoorTemperature();

    // `hass` is set on every state change in Home Assistant. History arrives
    // through the subscription, so only re-render when something this card
    // reads from `hass` itself changed.
    if (
      firstHass ||
      this._pressure() !== this._renderedPressure ||
      this._temperatureUnit() !== this._renderedUnit ||
      this._outdoorKey() !== this._renderedOutdoorKey ||
      this._inputs().some((input, i) => input !== this._renderedInputs[i])
    ) {
      this._render();
    }
  }

  setConfig(config: any) {
    if (!config.temperature) {
      throw new Error(this._t("missingTemperature"));
    }
    if (!config.humidity) {
      throw new Error(this._t("missingHumidity"));
    }
    this._config = config;
    this._ensureSubscription();
    this._refreshMeanOutdoorTemperature(true);
    this._render();
  }

  connectedCallback() {
    // Fill the grid cell in the sections view.
    this.style.display = "block";
    this.style.height = "100%";
    this._ensureSubscription();
    this._refreshMeanOutdoorTemperature();
    if (!this._pruneTimer) {
      this._pruneTimer = setInterval(() => {
        this._refreshMeanOutdoorTemperature();
        if (this._store?.prune()) {
          this._render();
        }
      }, PRUNE_INTERVAL_MS);
    }
  }

  disconnectedCallback() {
    this._teardownSubscription();
    if (this._pruneTimer) {
      clearInterval(this._pruneTimer);
      this._pruneTimer = undefined;
    }
  }

  private _hours() {
    const hours = Number(this._config?.hours);
    return Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_HOURS;
  }

  /** The unit the indoor temperature sensor reports in. */
  private _temperatureUnit() {
    return temperatureUnit(
      this._config ? this._hass?.states[this._config.temperature] : undefined,
      this._hass?.config?.unit_system?.temperature
    );
  }

  /** The history, with temperatures converted to °C for the chart. */
  private _points() {
    const source = this._store?.points() ?? [];
    const unit = this._temperatureUnit();
    const cached = this._celsiusPoints;
    if (!cached || cached.source !== source || cached.unit !== unit) {
      this._celsiusPoints = { source, unit, points: pointsInCelsius(source, unit) };
    }
    return this._celsiusPoints!.points;
  }

  /** The current outdoor states, to tell when the outdoor point moved. */
  private _outdoorKey() {
    const { outdoorTemperature, outdoorHumidity } = this._config ?? {};
    const states = this._hass?.states;
    return JSON.stringify([
      outdoorTemperature && states?.[outdoorTemperature]?.state,
      outdoorHumidity && states?.[outdoorHumidity]?.state,
    ]);
  }

  /** The current outdoor reading, in °C for the chart. */
  private _outdoor(): OutdoorReading | undefined {
    const { outdoorTemperature, outdoorHumidity } = this._config ?? {};
    const temperatureState = outdoorTemperature
      ? this._hass?.states[outdoorTemperature]
      : undefined;
    const value = parseNumericState(temperatureState?.state);
    if (!temperatureState || value === undefined) {
      return undefined;
    }
    const unit = temperatureUnit(
      temperatureState,
      this._hass?.config?.unit_system?.temperature
    );
    const humidityState = outdoorHumidity
      ? this._hass?.states[outdoorHumidity]
      : undefined;
    const humidity = parseNumericState(humidityState?.state);
    const usableHumidity =
      humidity !== undefined && humidity >= 0 && humidity <= 100
        ? humidity
        : undefined;
    const hass = this._hass as FormattingHass;
    return {
      temperature: temperatureToCelsius(value, unit) ?? value,
      humidity: usableHumidity,
      label:
        `${this._t("outdoor")} ${this._readingText(formatReading(hass, temperatureState))}` +
        (usableHumidity !== undefined
          ? ` · ${this._readingText(formatReading(hass, humidityState!))}`
          : ""),
    };
  }

  /** The parts of `hass` the readout depends on. */
  private _inputs(): unknown[] {
    const hass = this._hass as FormattingHass | undefined;
    const { temperature, humidity } = this._config ?? {};
    return [
      temperature && hass?.states[temperature],
      humidity && hass?.states[humidity],
      temperature && hass?.entities?.[temperature],
      humidity && hass?.entities?.[humidity],
      hass?.locale,
      hass?.config?.state,
    ];
  }

  /** A reading as text, with its unit where the user's language puts it. */
  private _readingText(reading: Reading) {
    if (!reading.unit) {
      return reading.value;
    }
    return reading.unitFirst
      ? `${reading.unit} ${reading.value}`
      : `${reading.value} ${reading.unit}`;
  }

  /**
   * Why the card cannot show its sensors, if it cannot: like the built-in
   * cards, a missing entity is a warning, worded differently while Home
   * Assistant is starting.
   */
  private _warning() {
    const hass = this._hass!;
    const { temperature, humidity } = this._config!;
    const missing = [temperature, humidity].filter((id) => !hass.states[id]);
    if (!missing.length) {
      return undefined;
    }
    if (hass.config?.state === "NOT_RUNNING") {
      return localize(hass, "ui.panel.lovelace.warning.starting", this._t("starting"));
    }
    return `${localize(hass, "ui.card.common.entity_not_found", this._t("entityNotFound"))}: ${missing.join(", ")}`;
  }

  /** The air pressure in Pa, from the sensor or from the elevation. */
  private _pressure() {
    const sensor = this._config?.pressure
      ? this._hass?.states[this._config.pressure]
      : undefined;
    return resolvePressure(sensor, this._hass?.config?.elevation).pressure;
  }

  /**
   * Fetches the outdoor sensor's mean over the last month from Home
   * Assistant's long-term statistics. Runs when the entity changes, and at
   * most hourly otherwise, unless `force` is set.
   */
  private _refreshMeanOutdoorTemperature(force = false) {
    if (!this.isConnected || !this._config || !this._hass?.callWS) {
      return;
    }
    const entityId = this._config.outdoorTemperature;
    const now = Date.now();
    if (
      !force &&
      entityId === this._meanOutdoorEntity &&
      (!entityId || now - this._meanOutdoorRequestedAt < MEAN_OUTDOOR_REFRESH_MS)
    ) {
      return;
    }
    if (entityId !== this._meanOutdoorEntity) {
      this._meanOutdoorTemperature = undefined;
    }
    this._meanOutdoorEntity = entityId;
    this._meanOutdoorRequestedAt = now;
    const request = ++this._meanOutdoorRequest;
    if (!entityId) {
      return;
    }

    fetchMeanOutdoorTemperature(this._hass.callWS.bind(this._hass), entityId)
      .then((mean) => {
        if (request !== this._meanOutdoorRequest) {
          return;
        }
        if (mean === undefined && !this._warnedNoStatistics.has(entityId)) {
          this._warnedNoStatistics.add(entityId);
          console.warn(
            `psychro-chart-card: ${entityId} has no long-term statistics, ` +
              "so the comfort zone uses the default mean outdoor temperature. " +
              "The sensor needs a state_class of measurement."
          );
        }
        if (mean !== this._meanOutdoorTemperature) {
          this._meanOutdoorTemperature = mean;
          this._render();
        }
      })
      .catch((error) => {
        console.error(
          "psychro-chart-card: could not load the mean outdoor temperature",
          error
        );
      });
  }

  /** Subscribes, or re-subscribes when the entities or window changed. */
  private _ensureSubscription() {
    if (!this.isConnected || !this._config || !this._hass?.connection) {
      return;
    }
    const { temperature, humidity } = this._config;
    const hours = this._hours();
    const key = JSON.stringify([temperature, humidity, hours]);
    if (
      this._unsubscribe &&
      key === this._subscriptionKey &&
      this._hass.connection === this._subscriptionConnection
    ) {
      return;
    }

    this._teardownSubscription();
    this._store = undefined;
    this._subscriptionKey = key;
    this._subscriptionConnection = this._hass.connection;
    this._unsubscribe = subscribeHistoryStream(
      this._hass.connection,
      { temperature, humidity },
      hours,
      (store) => {
        this._store = store;
        this._render();
      }
    );
  }

  private _teardownSubscription() {
    this._unsubscribe?.();
    this._unsubscribe = undefined;
    this._subscriptionKey = undefined;
    this._subscriptionConnection = undefined;
  }

  /**
   * Runs the action for a hold, or a double tap on a reading. More-info is
   * opened directly, for the reading's sensor; any other action is handed
   * to Home Assistant, as built-in cards do.
   */
  private _onGesture = (gesture: Gesture, readout?: Readout) => {
    if (!this._config) {
      return;
    }
    const entityId = readout ? this._config[readout] : this._config.temperature;
    const action = resolveAction(this._config, gesture, entityId);
    if (action?.kind === "more-info") {
      this._fire("hass-more-info", { entityId: action.entityId });
    } else if (action?.kind === "hass-action") {
      this._fire("hass-action", action.detail);
    }
  };

  /** One of the card's own strings, in the user's language. */
  private _t(key: StringKey) {
    return translate(languageOf(this._hass as any), key);
  }

  private _fire(type: string, detail: unknown) {
    this.dispatchEvent(
      new CustomEvent(type, { detail, bubbles: true, composed: true })
    );
  }

  private _render = () => {
    if (!this._config || !this._hass) {
      return;
    }
    const hass = this._hass as FormattingHass;
    this._renderedInputs = this._inputs();

    const warning = this._warning();
    if (warning) {
      render(
        customElements.get("hui-warning") ? (
          // @ts-ignore
          <hui-warning>{warning}</hui-warning>
        ) : (
          // @ts-ignore
          <ha-card
            style={{
              display: "block",
              padding: "16px",
              color: "var(--primary-text-color)",
              "border-color": "var(--warning-color, #ffa600)",
            }}
          >
            {warning}
            {/* @ts-ignore */}
          </ha-card>
        ),
        this
      );
      return;
    }

    this._renderedPressure = this._pressure();
    this._renderedUnit = this._temperatureUnit();
    this._renderedOutdoorKey = this._outdoorKey();
    const { temperature, humidity } = this._config;
    const points = this._points();
    const status = !this._store
      ? localize(hass, "ui.components.history_charts.loading_history", this._t("loading"))
      : points.length
        ? undefined
        : localize(hass, "ui.components.history_charts.no_history_found", this._t("noHistory"));
    const doubleTap = actionFor(this._config, "double_tap");

    render(
      // @ts-ignore
      <ha-card style={{ height: "100%", overflow: "hidden" }}>
        <Card
          history={points}
          readings={{
            temperature: formatReading(hass, hass.states[temperature]),
            humidity: formatReading(hass, hass.states[humidity]),
          }}
          temperatureUnit={this._renderedUnit}
          formatNumber={(value) => formatNumber(hass, value)}
          dewPointName={localize(hass, "ui.card.weather.attributes.dew_point", this._t("dewPoint"))}
          status={status}
          pressure={this._renderedPressure}
          meanOutdoorTemperature={this._meanOutdoorTemperature}
          outdoor={this._outdoor()}
          name={this._config.name}
          holdEnabled={hasAction(this._config, "hold")}
          doubleTapEnabled={hasAction(this._config, "double_tap")}
          readoutTitle={
            doubleTap?.action === "more-info"
              ? this._t("readoutTooltip")
              : undefined
          }
          onGesture={this._onGesture}
        />
        {/* @ts-ignore */}
      </ha-card>,
      this
    );
  };

  /** Height in the masonry view, in units of 50 px. */
  getCardSize() {
    return 3;
  }

  /** Size in the sections view: a 12-column grid with 56 px rows. */
  getGridOptions() {
    return { columns: 12, rows: 3, min_columns: 6, min_rows: 2 };
  }
}

if (!customElements.get(CARD_TYPE)) {
  customElements.define(CARD_TYPE, PsychroChartCard);
  console.info(
    `%c PSYCHRO-CHART-CARD %c ${VERSION} `,
    "color: white; background: #4caf50; font-weight: 700;",
    "color: #4caf50; background: white; font-weight: 700;"
  );
}

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    customCards?: any[];
  }
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === CARD_TYPE)) {
  window.customCards.push({
    type: CARD_TYPE,
    // Home Assistant has set the page's language by the time cards load.
    name: translate(languageOf(), "cardName"),
    description: translate(languageOf(), "cardDescription"),
    preview: true,
    documentationURL: DOCUMENTATION_URL,
    getEntitySuggestion: entitySuggestion,
  });
}
