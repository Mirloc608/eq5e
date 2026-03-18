// EQ5e Tool — Auto‑Generated Header

// tools/rename-duplicates.js
// Performs the full duplicate‑filename migration:
// 1. Renames files according to the canonical mapping
// 2. Rewrites all import paths across the system
// 3. Reports every change

export default async function renameDuplicates({ strict = false } = {}) {
  const fs = await import("node:fs");
  const fsp = await import("node:fs/promises");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    // ------------------------------------------------------------
    // Canonical rename map (old → new)
    // ------------------------------------------------------------
    const RENAME_MAP = {
      "module/world-simulation/world-hooks.js":
        "module/world-simulation/world-sim-hooks.js",

      "module/world-simulation/world-panel-extension.js":
        "module/world-simulation/world-sim-panel-extension.js",

      "module/world/world-simulation.js":
        "module/world/world-core-simulation.js",

      "module/world-simulation/world-simulation.js":
        "module/world-simulation/world-sim-engine.js",

      "module/eq5e.js":
        "module/eq5e-system.js",

      "scripts/eq5e.js":
        "scripts/eq5e-init.js"
    };

    // ------------------------------------------------------------
    // Import rewrite map (old → new)
    // ------------------------------------------------------------
    const IMPORT_MAP = {
      "world-hooks.js": "world-sim-hooks.js",
      "world-panel-extension.js": "world-sim-panel-extension.js",
      "world/world-simulation.js": "world/world-core-simulation.js",
      "world-simulation/world-simulation.js": "world-simulation/world-sim-engine.js",
      "module/eq5e.js": "module/eq5e-system.js",
      "scripts/eq5e.js": "scripts/eq5e-init.js"
    };

    const changedFiles = [];
    const updatedImports = [];

    // ------------------------------------------------------------
    // 1. Perform file renames
    // ------------------------------------------------------------
    for (const [oldRel, newRel] of Object.entries(RENAME_MAP)) {
      const oldPath = path.join(root, oldRel);
      const newPath = path.join(root, newRel);

      if (fs.existsSync(oldPath)) {
        const newDir = path.dirname(newPath);
        if (!fs.existsSync(newDir)) {
          await fsp.mkdir(newDir, { recursive: true });
        }
        await fsp.rename(oldPath, newPath);
        changedFiles.push(`${oldRel} → ${newRel}`);
      }
    }

    // ------------------------------------------------------------
    // 2. Rewrite imports across the system
    // ------------------------------------------------------------
    async function walk(dir) {
      const entries = await fsp.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const full = path.join(dir, entry.name);

        // Skip unwanted directories
        if (entry.isDirectory()) {
          const base = entry.name;
          if (
            base === "node_modules" ||
            base === "dist" ||
            base === "packs" ||
            base === "tools" ||
            base === "tests"
          ) {
            continue;
          }
          await walk(full);
          continue;
        }

        // Only process JS files
        if (entry.isFile() && entry.name.endsWith(".js")) {
          await rewriteImports(full);
        }
      }
    }

    async function rewriteImports(filePath) {
      let raw = await fsp.readFile(filePath, "utf8");
      let modified = false;

      for (const [oldFrag, newFrag] of Object.entries(IMPORT_MAP)) {
        if (raw.includes(oldFrag)) {
          raw = raw.split(oldFrag).join(newFrag);
          modified = true;
        }
      }

      if (modified) {
        await fsp.writeFile(filePath, raw, "utf8");
        updatedImports.push(filePath);
      }
    }

    await walk(root);

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    console.log("✔ rename-duplicates completed\n");

    if (changedFiles.length > 0) {
      console.log("Renamed files:");
      for (const line of changedFiles) console.log(" - " + line);
      console.log("");
    }

    if (updatedImports.length > 0) {
      console.log("Updated imports in:");
      for (const file of updatedImports) console.log(" - " + file);
      console.log("");
    }

    if (changedFiles.length === 0 && updatedImports.length === 0) {
      console.log("No changes were necessary");
    }
  } catch (err) {
    console.log("⚠ rename-duplicates encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e System
