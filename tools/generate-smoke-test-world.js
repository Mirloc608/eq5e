// EQ5e Tool — Auto‑Generated Header

// tools/generate-smoke-test-world.js
// Creates a minimal Foundry smoke-test world to validate system loading.

export default async function generateSmokeTestWorld({ strict = false, force = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");
  const crypto = await import("node:crypto");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const worldDir = path.join(root, "smoke-test-world");

    // Prevent accidental overwrite
    if (fs.existsSync(worldDir) && !force) {
      console.log("✔ smoke-test-world already exists (use force=true to regenerate)");
      return;
    }

    // Reset folder
    if (fs.existsSync(worldDir)) {
      fs.rmSync(worldDir, { recursive: true, force: true });
    }
    fs.mkdirSync(worldDir);

    // --- world.json ---
    const worldJson = {
      name: "smoke-test-world",
      title: "EQ5e Smoke Test World",
      description: "Automatically generated world for CI validation.",
      version: "1.0.0",
      system: "eq5e",
      coreVersion: "12",
      compatibility: {
        minimum: "12",
        verified: "12"
      }
    };

    fs.writeFileSync(
      path.join(worldDir, "world.json"),
      JSON.stringify(worldJson, null, 2)
    );

    // --- packs folder ---
    const packsDir = path.join(worldDir, "packs");
    fs.mkdirSync(packsDir);

    // Minimal actors.db
    const actorsDb = [
      {
        _id: crypto.randomUUID(),
        name: "Smoke Test Actor",
        type: "npc",
        system: {}
      }
    ]
      .map(e => JSON.stringify(e))
      .join("\n");

    fs.writeFileSync(path.join(packsDir, "actors.db"), actorsDb);

    // Minimal items.db
    const itemsDb = [
      {
        _id: crypto.randomUUID(),
        name: "Smoke Test Item",
        type: "item",
        system: {}
      }
    ]
      .map(e => JSON.stringify(e))
      .join("\n");

    fs.writeFileSync(path.join(packsDir, "items.db"), itemsDb);

    console.log("✔ generate-smoke-test-world created a minimal Foundry world");
  } catch (err) {
    console.log("⚠ generate-smoke-test-world encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
