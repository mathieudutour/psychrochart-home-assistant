// The preview page, also published to GitHub Pages: mounts the real card
// with a mock Home Assistant, and wires up the page's controls.
import "../src/psychro-chart-card";
import {
  HUMIDITY,
  OUTDOOR,
  OUTDOOR_HUMIDITY,
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
let name = "";

function config() {
  return {
    type: "custom:psychro-chart-card",
    ...(name ? { name } : {}),
    temperature: TEMPERATURE,
    humidity: HUMIDITY,
    hours,
    ...(useOutdoor
      ? { outdoorTemperature: OUTDOOR, outdoorHumidity: OUTDOOR_HUMIDITY }
      : {}),
    ...(usePressureSensor ? { pressure: PRESSURE } : {}),
  };
}

function reconfigure() {
  for (const card of cards) card.setConfig(config());
  setHass(mock.snapshot());
  updateYaml();
}

/** The card's configuration as YAML, as it would go in a dashboard. */
function updateYaml() {
  const lines = Object.entries(config()).map(([key, value]) => `${key}: ${value}`);
  document.getElementById("yaml")!.textContent = lines.join("\n");
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

// Home Assistant opens its more-info dialog on this event; show what was
// asked for instead.
const toast = document.getElementById("toast")!;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
document.addEventListener("hass-more-info", (event) => {
  const { entityId } = (event as CustomEvent<{ entityId: string }>).detail;
  toast.textContent = `Home Assistant would open the details of ${entityId}`;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), 3000);
});

const themeSelect = document.getElementById("theme") as HTMLSelectElement;
function applyTheme() {
  document.documentElement.dataset.theme = themeSelect.value;
  document.getElementById("theme-vars")!.hidden = !themeSelect.value.startsWith("rounded");
}
// Start in the visitor's light or dark mode.
themeSelect.value = matchMedia("(prefers-color-scheme: light)").matches
  ? "default-light"
  : "default-dark";
applyTheme();
themeSelect.addEventListener("change", applyTheme);

const nameInput = document.getElementById("name") as HTMLInputElement;
nameInput.addEventListener("input", () => {
  name = nameInput.value.trim();
  reconfigure();
});

// Touch screens have no hover: describe taps instead.
if (matchMedia("(hover: none)").matches) {
  document.getElementById("hint")!.textContent =
    "Tap the card for the dew point, axis labels and outdoor air. Double-tap a reading for its sensor.";
}

for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>("[data-copy]"))) {
  button.addEventListener("click", async () => {
    const text = document.getElementById(button.dataset.copy!)!.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied";
    } catch {
      button.textContent = "Select and copy";
    }
    setTimeout(() => (button.textContent = "Copy"), 1500);
  });
}

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

updateYaml();

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
