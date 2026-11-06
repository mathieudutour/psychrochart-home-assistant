# Psychrochart

Psychrochart is a small Next.js and Preact project for rendering a
psychrometric chart from temperature and relative humidity history. The main
target is a Home Assistant Lovelace custom card, with a local Next.js page for
previewing the chart during development.

The chart plots temperature against absolute humidity, draws relative humidity
curves, overlays a comfort zone, and fades the historical path so the latest
indoor state is easy to spot.

## Screenshots

![Psychrochart card in dark theme](docs/Screenshot%202026-06-25%20at%2010.18.45.png)

![Psychrochart card in light theme](docs/Screenshot%202026-06-25%20at%2010.19.58.png)

## Features

- Home Assistant custom element: `psychro-chart-card`
- Configurable temperature and humidity entities
- Configurable Home Assistant history window, kept live through the
  `history/stream` websocket subscription
- Psychrometric calculations based on saturation vapor pressure and humidity
  ratio at standard atmospheric pressure
- Local Next.js preview with sample data
- Single bundled output file for Home Assistant: `out.js`

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

Open [http://localhost:3000](http://localhost:3000). The preview uses sample
history data from `src/app/page.tsx`.

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

This runs esbuild against `src/psychro-chart-card.tsx` and writes the minified
bundle to `out.js`.

## Home Assistant Installation

1. Build the bundle:

   ```bash
   npm run build
   ```

2. Copy `out.js` into your Home Assistant `www` directory, for example:

   ```bash
   cp out.js /config/www/psychro-chart-card.js
   ```

3. Add the JavaScript module as a Lovelace resource:

   ```yaml
   url: /local/psychro-chart-card.js
   type: module
   ```

4. Add the card to a dashboard:

   ```yaml
   type: custom:psychro-chart-card
   temperature: sensor.living_room_temperature
   humidity: sensor.living_room_humidity
   hours: 24
   ```

## Card Configuration

| Option | Required | Description |
| --- | --- | --- |
| `temperature` | Yes | Home Assistant entity ID for the temperature sensor. Values are expected in C. |
| `humidity` | Yes | Home Assistant entity ID for the relative humidity sensor. Values are expected as percent RH. |
| `hours` | No | Number of hours of Home Assistant history to load. Defaults to `24`. |
| `outdoorTemperature` | No | Optional entity currently passed through to the chart component. The current comfort-zone calculation still uses the latest plotted temperature. |

The card subscribes to Home Assistant's `history/stream` websocket command for
the temperature and humidity entities. Home Assistant sends the history for the
window once, then pushes each new state, so the card never re-downloads the
window. States that are not numbers, such as `unknown` and `unavailable`, are
skipped. Each series carries its last value forward, and a point is plotted
wherever both a temperature and a humidity are known. Points older than the
window are dropped, both when new states arrive and once a minute. After a
websocket reconnect the card starts a fresh subscription for the current
window.

## Project Structure

```text
src/
  psychro-chart-card.tsx  Home Assistant custom card entry point
  history.ts              History stream subscription, merging and pruning
  app/
    chart.tsx             SVG psychrometric chart
    states.tsx            Current temperature and humidity readout
    physic.ts             Psychrometric formulas
    getComfortZone.ts     Comfort-zone and relative-humidity curve helpers
    geometry.ts           Small interpolation and clamping helpers
    page.tsx              Local Next.js preview data and page
test/
  history.test.ts         Unit tests for the history logic
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local Next.js preview. |
| `npm run build` | Bundle the Home Assistant custom card to `out.js`. |
| `npm run lint` | Run Next.js linting. |
| `npm run typecheck` | Type-check the project with TypeScript. |
| `npm test` | Run the unit tests with Node's test runner. |
| `npm start` | Start a production Next.js server, if a production build exists. |

## Notes

- The chart currently spans 5 C to 40 C on the temperature axis.
- Absolute humidity is plotted from 0 to about 35 g/kg.
- Relative humidity guide curves are drawn from 0 percent to 100 percent in 10
  percent increments.
- The comfort zone switches to winter behavior during January through May and
  November through December.
