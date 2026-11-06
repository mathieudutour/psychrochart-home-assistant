import { HomeAssistant } from "custom-card-helpers";
import { render } from "preact";
import Card from "./app/chart";
import {
  fetchMeanOutdoorTemperature,
  pointsInCelsius,
  resolvePressure,
  temperatureUnit,
} from "./environment";
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
  temperature: string;
  humidity: string;
  /** Outdoor temperature sensor; its monthly mean sets the comfort zone. */
  outdoorTemperature?: string;
  /** Barometric pressure sensor. Defaults to the pressure at the elevation. */
  pressure?: string;
  hours?: number;
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
      this._temperatureUnit() !== this._renderedUnit
    ) {
      this._render();
    }
  }

  setConfig(config: any) {
    if (!config.temperature) {
      throw new Error("You need to define a temperature entity");
    }
    if (!config.humidity) {
      throw new Error("You need to define a humidity entity");
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

  /** The air pressure in Pa, from the sensor or from the elevation. */
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

  private _render = () => {
    if (!this._config || !this._hass) {
      return;
    }
    this._renderedPressure = this._pressure();
    this._renderedUnit = this._temperatureUnit();
    const current = this._store?.current();

    render(
      // @ts-ignore
      <ha-card style={{ height: "100%", overflow: "hidden" }}>
        <Card
          history={this._points()}
          current={
            current && { ...current, temperatureUnit: this._renderedUnit }
          }
          pressure={this._renderedPressure}
          meanOutdoorTemperature={this._meanOutdoorTemperature}
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
    name: "Psychrometric Chart",
    description:
      "Plots indoor temperature and humidity history on a psychrometric chart, with a comfort zone.",
    preview: true,
    documentationURL: DOCUMENTATION_URL,
    getEntitySuggestion: entitySuggestion,
  });
}
