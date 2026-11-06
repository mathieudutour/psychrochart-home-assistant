// Builds the preview page as a static site in site/, for GitHub Pages.
import { build } from "esbuild";
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

const out = new URL("../site/", import.meta.url);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: ["dev/preview.ts"],
  bundle: true,
  minify: true,
  target: "es2020",
  outfile: "site/preview.js",
  define: { LIVE_RELOAD: "false" },
  logLevel: "info",
});
copyFileSync(new URL("../dev/index.html", import.meta.url), new URL("index.html", out));
// Serve the files as they are, without Jekyll.
writeFileSync(new URL(".nojekyll", out), "");
