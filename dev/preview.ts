// Local preview: mounts the real card with a mock Home Assistant.
import "../src/psychro-chart-card";
import {
  HUMIDITY,
  OUTDOOR,
  PRESSURE,
  TEMPERATURE,
  createMockHass,
} from "./mock-hass";

type Card = HTMLElement & {
  setConfig(config: Record<string, unknown>): void;
  hass: unknown;
};

const mock = createMockHass();
// Handy from the browser console.
(window as any).mock = mock;
const cards: Card[] = [];
let hours = 24;
let useOutdoor = true;
let usePressureSensor = false;

function config() {
  return {
    type: "custom:psychro-chart-card",
    temperature: TEMPERATURE,
    humidity: HUMIDITY,
    hours,
    ...(useOutdoor ? { outdoorTemperature: OUTDOOR } : {}),
    ...(usePressureSensor ? { pressure: PRESSURE } : {}),
  };
}

function reconfigure() {
  for (const card of cards) card.setConfig(config());
  setHass(mock.snapshot());
}

// Home Assistant creates the card, configures it, sets hass, then attaches it.
for (const slot of Array.from(document.querySelectorAll<HTMLElement>("[data-card]"))) {
  const card = document.createElement("psychro-chart-card") as Card;
  card.setConfig(config());
  card.hass = mock.snapshot();
  slot.append(card);
  cards.push(card);
}

function setHass(hass: unknown) {
  for (const card of cards) card.hass = hass;
  updateStatus();
}

// Sensors change on 5 and 7 minute boundaries; check often like a real
// dashboard would receive them.
setInterval(() => setHass(mock.tick()), 5000);

const status = document.getElementById("status")!;
function updateStatus() {
  const { states } = mock.snapshot();
  status.textContent =
    `${states[TEMPERATURE].state} °C · ${states[HUMIDITY].state} % · ` +
    `${mock.connection.activeSubscriptions} active / ` +
    `${mock.connection.subscribeCount} opened subscriptions · ` +
    `${mock.statisticsRequests} statistics requests`;
}
updateStatus();
// Unsubscribing is async, so also refresh the counts on a timer.
setInterval(updateStatus, 1000);

const themeSelect = document.getElementById("theme") as HTMLSelectElement;
themeSelect.addEventListener("change", () => {
  document.documentElement.dataset.theme = themeSelect.value;
});

const hoursSelect = document.getElementById("hours") as HTMLSelectElement;
hoursSelect.value = String(hours);
hoursSelect.addEventListener("change", () => {
  hours = Number(hoursSelect.value);
  reconfigure();
});

const outdoorSelect = document.getElementById("outdoor") as HTMLSelectElement;
outdoorSelect.addEventListener("change", () => {
  const value = outdoorSelect.value;
  useOutdoor = value !== "none";
  mock.setOutdoorMean(value === "none" || value === "nostats" ? null : Number(value));
  reconfigure();
});

const pressureSelect = document.getElementById("pressure") as HTMLSelectElement;
pressureSelect.addEventListener("change", () => {
  const [state, unit] = pressureSelect.value.split(" ");
  usePressureSensor = pressureSelect.value !== "elevation";
  if (usePressureSensor) mock.setPressure(state, unit);
  reconfigure();
});

const unitSelect = document.getElementById("unit") as HTMLSelectElement;
unitSelect.addEventListener("change", () => {
  setHass(mock.setTemperatureUnit(unitSelect.value as "°C" | "°F"));
  // Fetch the history again in the new unit, as reloading the page would.
  mock.connection.simulateReconnect();
});

const elevationSelect = document.getElementById("elevation") as HTMLSelectElement;
elevationSelect.addEventListener("change", () => {
  setHass(mock.setElevation(Number(elevationSelect.value)));
});

document.getElementById("unknown")!.addEventListener("click", () => {
  setHass(mock.push(TEMPERATURE, "unknown"));
});

document.getElementById("reconnect")!.addEventListener("click", () => {
  mock.connection.simulateReconnect();
  updateStatus();
});

/** Set by `npm run dev`, whose esbuild server reports rebuilds. */
declare const LIVE_RELOAD: boolean | undefined;
if (typeof LIVE_RELOAD !== "undefined" && LIVE_RELOAD) {
  new EventSource("/esbuild").addEventListener("change", () => location.reload());
}
