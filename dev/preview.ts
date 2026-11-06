// Local preview: mounts the real card with a mock Home Assistant.
import "../src/psychro-chart-card";
import { HUMIDITY, TEMPERATURE, createMockHass } from "./mock-hass";

type Card = HTMLElement & {
  setConfig(config: Record<string, unknown>): void;
  hass: unknown;
};

const mock = createMockHass();
// Handy from the browser console.
(window as any).mock = mock;
const cards: Card[] = [];
let hours = 24;

function config() {
  return { type: "custom:psychro-chart-card", temperature: TEMPERATURE, humidity: HUMIDITY, hours };
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
    `${mock.connection.subscribeCount} opened subscriptions`;
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
  for (const card of cards) card.setConfig(config());
  updateStatus();
});

document.getElementById("unknown")!.addEventListener("click", () => {
  setHass(mock.push(TEMPERATURE, "unknown"));
});

document.getElementById("reconnect")!.addEventListener("click", () => {
  mock.connection.simulateReconnect();
  updateStatus();
});

new EventSource("/esbuild").addEventListener("change", () => location.reload());
