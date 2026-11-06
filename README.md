# Psychrochart

Psychrochart is a small Preact project for rendering a psychrometric chart
from temperature and relative humidity history. The main target is a Home
Assistant Lovelace custom card, with a local preview page backed by a mock
Home Assistant for development.

The chart plots temperature against humidity ratio (grams of water vapour per
kilogram of dry air), draws relative humidity curves, overlays a comfort zone,
and fades the historical path so the latest indoor state is easy to spot.

## Screenshots

![Psychrochart card in dark theme](docs/Screenshot%202026-06-25%20at%2010.18.45.png)

![Psychrochart card in light theme](docs/Screenshot%202026-06-25%20at%2010.19.58.png)

## Features

- Home Assistant custom element: `psychro-chart-card`
- Configurable temperature and humidity entities
- Configurable Home Assistant history window, kept live through the
  `history/stream` websocket subscription
- Psychrometric calculations from the ASHRAE Handbook—Fundamentals equations,
  at the barometric pressure from a sensor or from your elevation
- A comfort zone set by the mean outdoor temperature of the last 30 days
- Local preview page with a mock Home Assistant
- Installable with HACS, with a visual editor, card picker suggestions and
  sizing for both masonry and sections dashboards

## Requirements

- Node.js 18 or newer
- npm
- Home Assistant 2023.2 or newer, if you want to use the generated Lovelace
  card (it relies on the `history/stream` websocket command)

## Development

Install dependencies:

```bash
npm install
```

Start the local preview:

```bash
npm run dev
```

Open [http://localhost:8000](http://localhost:8000). The page rebuilds and
reloads when you change a file.

The preview mounts the real `psychro-chart-card` element with a mock Home
Assistant from `dev/mock-hass.ts`. The mock answers `history/stream` with a
simulated day of readings, including a few `unknown` and `unavailable`
states, then pushes live updates. The page has controls to switch between
light and dark themes, change the history window, the outdoor sensor's 30-day
mean, the pressure sensor and the elevation, push an `unknown` state and
simulate a websocket reconnect.

Run the type checker and the unit tests:

```bash
npm run typecheck
npm test
```

## Build

Build the Home Assistant card bundle:

```bash
npm run build
```

This bundles `src/psychro-chart-card.tsx` with esbuild into
`dist/psychrochart-home-assistant.js`. The build output is not committed:
GitHub releases carry it.

## Home Assistant Installation

### With HACS

[![Open your Home Assistant instance and open this repository in HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=mathieudutour&repository=psychrochart-home-assistant&category=plugin)

1. In HACS, open the menu in the top right corner and choose **Custom
   repositories**.
2. Add `https://github.com/mathieudutour/psychrochart-home-assistant` with the
   type **Dashboard**.
3. Find **Psychrometric Chart Card** in HACS and download it. HACS adds the
   dashboard resource for you.
4. Reload the browser.

### Manually

1. Download `psychrochart-home-assistant.js` from the
   [latest release](https://github.com/mathieudutour/psychrochart-home-assistant/releases/latest),
   or build it with `npm run build`.
2. Copy it into your Home Assistant `www` directory, for example
   `/config/www/psychrochart-home-assistant.js`.
3. Add it as a dashboard resource (**Settings → Dashboards → ⋮ → Resources**):

   ```yaml
   url: /local/psychrochart-home-assistant.js
   type: module
   ```

### Adding the card

Edit a dashboard, choose **Add card** and pick **Psychrometric Chart**. The
card starts with a temperature and a humidity sensor from the same device, if
you have one, and every option can be set in the visual editor. On Home
Assistant 2026.6 or newer, the card is also suggested when you pick a
temperature or humidity sensor that has a partner on the same device.

In YAML:

```yaml
type: custom:psychro-chart-card
temperature: sensor.living_room_temperature
humidity: sensor.living_room_humidity
outdoorTemperature: sensor.outdoor_temperature
pressure: sensor.barometric_pressure
hours: 24
```

In a sections dashboard the card takes the full width and three rows by
default, and can be resized down to half the width and two rows.

## Card Configuration

| Option | Required | Description |
| --- | --- | --- |
| `temperature` | Yes | Home Assistant entity ID for the temperature sensor, in °C, °F or K. The readout shows the sensor's own value and unit. |
| `humidity` | Yes | Home Assistant entity ID for the relative humidity sensor. Values are expected as percent RH. |
| `hours` | No | Number of hours of Home Assistant history to load. Defaults to `24`. |
| `outdoorTemperature` | No | Outdoor temperature sensor. Its mean over the last 30 days positions the comfort zone. It needs long-term statistics, which Home Assistant keeps for sensors with a `state_class` of `measurement`. Without it, the comfort zone assumes a mean of 19 °C. |
| `pressure` | No | Barometric pressure sensor, in any unit Home Assistant uses (hPa, mbar, kPa, Pa, bar, inHg, mmHg or psi). It must report station pressure, not pressure adjusted to sea level. Without it, or when its reading is not usable, the card uses the standard atmosphere at the elevation set in Home Assistant. |

The card subscribes to Home Assistant's `history/stream` websocket command for
the temperature and humidity entities. Home Assistant sends the history for the
window once, then pushes each new state, so the card never re-downloads the
window. States that are not numbers, such as `unknown` and `unavailable`, are
skipped. Each series carries its last value forward, and a point is plotted
wherever both a temperature and a humidity are known. Points older than the
window are dropped, both when new states arrive and once a minute. After a
websocket reconnect the card starts a fresh subscription for the current
window.

### Units

The card reads the temperature sensor's unit from its `unit_of_measurement`,
or from Home Assistant's unit system when the sensor has none, and converts
readings to °C for the chart. The outdoor mean is requested in °C from Home
Assistant, which converts it, so the outdoor sensor can use any unit too.

History is stored in the unit a sensor used at the time. After you change a
sensor's unit, the trail mixes old and new readings until the old ones leave
the history window.

### Comfort Zone

The comfort zone is the one from the Givoni bioclimatic chart, as drawn by
[Andrew Marsh's psychrometric chart](https://andrewmarsh.com/software/psychro-chart-web/).
Its lowest temperature is Auliciems' neutral temperature,
`17.6 + 0.31 × mean outdoor temperature`, less 3.5 °C. The zone is 7 °C wide,
lies between 20% and 80% relative humidity and below 16 g/kg, and its warmest
part is limited to 50% relative humidity. Because the neutral temperature
depends on the outdoor climate, the zone moves with the seasons rather than
with the indoor reading.

The mean outdoor temperature comes from Home Assistant's long-term statistics
(`recorder/statistic_during_period`, a 30-day rolling window, converted to °C)
and is refreshed hourly.

### Air Pressure

The humidity ratio of air at a given temperature and relative humidity depends
on the air pressure: it is about 6% higher at 500 m and 20% higher at 1500 m
than at sea level. The card uses the `pressure` sensor when one is configured,
otherwise the ASHRAE standard atmosphere at Home Assistant's elevation.

Many weather stations and integrations report pressure adjusted to sea level.
That value is wrong for psychrometrics away from the coast, so only use a
sensor that reports the actual pressure where you are.

## Project Structure

```text
src/
  psychro-chart-card.tsx  Home Assistant custom card entry point
  setup.ts                Card picker, stub config and visual editor form
  history.ts              History stream subscription, merging and pruning
  environment.ts          Air pressure and mean outdoor temperature
  app/
    chart.tsx             SVG psychrometric chart
    states.tsx            Current temperature and humidity readout
    physic.ts             Psychrometric formulas (ASHRAE Fundamentals, ch. 1)
    getComfortZone.ts     Comfort-zone and relative-humidity curve helpers
    geometry.ts           Rounding helper
dev/
  index.html              Local preview page
  preview.ts              Mounts the card with the mock
  mock-hass.ts            Mock Home Assistant states, history and statistics
test/
  history.test.ts         History stream logic
  physic.test.ts          Psychrometrics, against ASHRAE tables and PsychroLib
  comfort.test.ts         Comfort zone and relative humidity curves
  environment.test.ts     Pressure and mean outdoor temperature
  setup.test.ts           Card picker and editor helpers
scripts/
  build.mjs               Builds dist/psychrochart-home-assistant.js
.github/workflows/
  ci.yml                  Type-check, test and build on every push and PR
  release.yml             Attaches the build to each published release
  validate.yml            HACS validation
hacs.json                 HACS manifest
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Serve the local preview on port 8000 and rebuild on change. |
| `npm run build` | Bundle the card to `dist/psychrochart-home-assistant.js`. |
| `npm run typecheck` | Type-check the project with TypeScript. |
| `npm test` | Run the unit tests with Node's test runner. |

## Releasing

1. Publish a GitHub release with a version tag such as `v0.2.0`.
2. The **Release** workflow tests the code, builds the card with that version
   and attaches `psychrochart-home-assistant.js` to the release.
3. HACS offers the new version to users. The card logs its version in the
   browser console when it loads.

## Notes

- The chart currently spans 5 °C to 40 °C (41 °F to 104 °F) on the
  temperature axis.
- Humidity ratio is plotted from 0 to about 35 g/kg.
- Relative humidity guide curves are drawn from 0 percent to 100 percent in 10
  percent increments.
- The comfort zone switches to winter behavior during January through May and
  November through December.

## License

[MIT](LICENSE)
