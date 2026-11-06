import { HomeAssistant } from "custom-card-helpers";
import { render } from "preact";
import Card from "./app/chart";
import { fetchMeanOutdoorTemperature, resolvePressure } from "./environment";
import { HistoryStore, subscribeHistoryStream } from "./history";

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
  private _config: CardConfig | undefined;
  private _hass: HomeAssistant | undefined;
  private _store: HistoryStore | undefined;

  private _unsubscribe: (() => void) | undefined;
  private _subscriptionKey: string | undefined;
  private _subscriptionConnection: HomeAssistant["connection"] | undefined;
  private _pruneTimer: ReturnType<typeof setInterval> | undefined;
  private _renderedPressure: number | undefined;

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
    if (firstHass || this._pressure() !== this._renderedPressure) {
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

    render(
      // @ts-ignore
      <ha-card>
        <Card
          history={this._store?.points() ?? []}
          current={this._store?.current()}
          pressure={this._renderedPressure}
          meanOutdoorTemperature={this._meanOutdoorTemperature}
        />
        {/* @ts-ignore */}
      </ha-card>,
      this
    );
  };

  getCardSize() {
    return 1;
  }
}

customElements.define("psychro-chart-card", PsychroChartCard);

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    customCards?: any[];
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "psychro-chart-card",
  name: "Psychrometric Chart",
  preview: false,
  description: "Psychrometric Chart",
});
