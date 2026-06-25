import { HomeAssistant } from "custom-card-helpers";
import { HassEntity } from "home-assistant-js-websocket";
import { render } from "preact";
import Card from "./app/chart";

class PsychroChartCard extends HTMLElement {
  _config:
    | {
        temperature: string;
        humidity: string;
        outdoorTemperature?: string;
        hours?: number;
      }
    | undefined;
  _hass: HomeAssistant | undefined;

  _temperatureEntity: HassEntity | undefined;
  _humidityEntity: HassEntity | undefined;
  _history: {
    temperature?: string;
    humidity?: string;
    lastChanged: number;
  }[] = [];

  set hass(hass: HomeAssistant | undefined) {
    // @ts-ignore
    window.hass = hass;
    this._hass = hass;

    if (this._config && hass) {
      const newTemperature = hass?.states[this._config.temperature];
      const newHumidity = hass?.states[this._config.humidity];

      if (newTemperature && newTemperature !== this._temperatureEntity) {
        this._temperatureEntity = newTemperature;
        this._updateEntity("temperature", newTemperature);
      }

      if (newHumidity && newHumidity !== this._humidityEntity) {
        this._humidityEntity = newHumidity;
        this._updateEntity("humidity", newHumidity);
      }
    }

    this._render();
  }

  setConfig(config: any) {
    if (!config.temperature) {
      throw new Error("You need to define a temperature entity");
    }
    if (!config.humidity) {
      throw new Error("You need to define a humidity entity");
    }
    this._config = config;
    this._render();
  }

  private _updateEntity = async (
    entity: "temperature" | "humidity",
    newEntity: HassEntity
  ) => {
    if (!this._config || !this._hass) {
      return;
    }

    const start = new Date();
    start.setMilliseconds(
      start.getMilliseconds() - 1000 * 60 * 60 * (this._config.hours || 24)
    );

    const [history]: { state: string; last_changed: string }[][] =
      await this._hass.callApi(
        "GET",
        `history/period/${start.toISOString()}?filter_entity_id=${
          newEntity.entity_id
        }&minimal_response&end_time=${new Date().toISOString()}`
      );

    history.forEach((item) => {
      const lastChanged = new Date(item.last_changed).getTime();

      const existingEntry = this._history.find(
        (x) => x.lastChanged === lastChanged
      );

      if (!existingEntry) {
        this._history.push({
          [entity]: item.state,
          lastChanged,
        });
      } else {
        existingEntry[entity] = item.state;
      }
    });

    let previousTemperature: string | undefined;
    let previousHumidity: string | undefined;

    this._history = this._history
      .sort((a, b) => {
        return a.lastChanged - b.lastChanged;
      })
      .map((x) => {
        if (x.temperature === undefined) {
          x.temperature = previousTemperature;
        } else {
          previousTemperature = x.temperature;
        }

        if (x.humidity === undefined) {
          x.humidity = previousHumidity;
        } else {
          previousHumidity = x.humidity;
        }

        return x;
      });

    this._render();
  };

  private _render = () => {
    if (!this._config || !this._hass) {
      return;
    }

    render(
      // @ts-ignore
      <ha-card>
        <Card
          history={this._history}
          outdoorTemperature={
            this._config.outdoorTemperature
              ? this._hass.states[this._config.outdoorTemperature]?.state
              : undefined
          }
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
