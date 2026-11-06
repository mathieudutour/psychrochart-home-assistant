// Compiles test/*.test.ts into .test-build/ and runs them with Node's test
// runner. The output directory is wiped first so tests whose source was
// deleted, renamed or only exists on another branch are never run.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const testDir = "test";
const outdir = ".test-build";

rmSync(outdir, { recursive: true, force: true });

// Listed here rather than passed as a glob, since neither cmd.exe nor
// Node 20's test runner expands globs.
const entryPoints = readdirSync(testDir)
  .filter((name) => name.endsWith(".test.ts"))
  .sort()
  .map((name) => join(testDir, name));

if (entryPoints.length === 0) {
  console.error(`No *.test.ts files found in ${testDir}/`);
  process.exit(1);
}

await build({
  entryPoints,
  bundle: true,
  platform: "node",
  outdir,
  logLevel: "warning",
});

const testFiles = readdirSync(outdir)
  .filter((name) => name.endsWith(".test.js"))
  .sort()
  .map((name) => join(outdir, name));

const { status, signal } = spawnSync(
  process.execPath,
  ["--test", ...testFiles],
  { stdio: "inherit" }
);

process.exit(signal ? 1 : status ?? 1);
