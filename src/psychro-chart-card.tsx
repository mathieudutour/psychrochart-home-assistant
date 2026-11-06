import { HomeAssistant } from "custom-card-helpers";
import { render } from "preact";
import Card from "./app/chart";
import { HistoryStore, subscribeHistoryStream } from "./history";

type CardConfig = {
  temperature: string;
  humidity: string;
  outdoorTemperature?: string;
  hours?: number;
};

const DEFAULT_HOURS = 24;
/** How often old points are dropped when no new state arrives. */
const PRUNE_INTERVAL_MS = 60 * 1000;

class PsychroChartCard extends HTMLElement {
  private _config: CardConfig | undefined;
  private _hass: HomeAssistant | undefined;
  private _store: HistoryStore | undefined;

  private _unsubscribe: (() => void) | undefined;
  private _subscriptionKey: string | undefined;
  private _subscriptionConnection: HomeAssistant["connection"] | undefined;
  private _pruneTimer: ReturnType<typeof setInterval> | undefined;
  private _outdoorState: string | undefined;

  set hass(hass: HomeAssistant | undefined) {
    const firstHass = !this._hass;
    this._hass = hass;
    this._ensureSubscription();

    // `hass` is set on every state change in Home Assistant. History now
    // arrives through the subscription, so only re-render when something
    // this card shows from `hass` itself changed.
    const outdoorState = this._getOutdoorState();
    if (firstHass || outdoorState !== this._outdoorState) {
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
    this._render();
  }

  connectedCallback() {
    this._ensureSubscription();
    if (!this._pruneTimer) {
      this._pruneTimer = setInterval(() => {
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

  private _getOutdoorState() {
    return this._config?.outdoorTemperature
      ? this._hass?.states[this._config.outdoorTemperature]?.state
      : undefined;
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
    this._outdoorState = this._getOutdoorState();

    render(
      // @ts-ignore
      <ha-card>
        <Card
          history={this._store?.points() ?? []}
          current={this._store?.current()}
          outdoorTemperature={this._outdoorState}
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
