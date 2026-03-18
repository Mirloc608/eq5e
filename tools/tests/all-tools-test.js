import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const toolsDir = path.resolve(__dirname, "..");

// Discover all tool scripts (exclude cli.mjs and tests folder)
const toolFiles = fs.readdirSync(toolsDir)
  .filter(f => f.endsWith(".js") && f !== "cli.mjs");

for (const file of toolFiles) {
  const name = file.replace(".js", "");

  test(`${name} loads`, async () => {
    const mod = await import(path.join(toolsDir, file));
    assert.ok(mod);
  });
}
