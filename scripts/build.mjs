// Builds the card bundle that Home Assistant loads.
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);

await build({
  entryPoints: ["src/psychro-chart-card.tsx"],
  bundle: true,
  minify: true,
  // Wall-mounted tablets often run older browsers.
  target: "es2020",
  outfile: "dist/psychrochart-home-assistant.js",
  define: { __CARD_VERSION__: JSON.stringify(version) },
  logLevel: "info",
});
