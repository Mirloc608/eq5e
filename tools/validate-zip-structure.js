// EQ5e Tool — Auto‑Generated Header

// tools/validate-zip-structure.js
// Validates that the built ZIP has the correct FoundryVTT system structure.

export default async function validateZipStructure({ strict = false } = {}) {
  const fs = await import("node:fs");
  const fsp = await import("node:fs/promises");
  const path = await import("node:path");
  const url = await import("node:url");

  // ESM-safe ZIP reader
  const JSZip = (await import("jszip")).default;

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const dist = path.join(root, "dist");

    if (!fs.existsSync(dist)) {
      console.log("⚠ dist folder not found");
      if (strict) throw new Error("ZIP structure validation failed");
      return;
    }

    const files = await fsp.readdir(dist);
    const zipName = files.find(f => f.endsWith(".zip"));

    if (!zipName) {
      console.log("⚠ No ZIP file found in dist/");
      if (strict) throw new Error("ZIP structure validation failed");
      return;
    }

    const zipPath = path.join(dist, zipName);
    const data = await fsp.readFile(zipPath);
    const zip = await JSZip.loadAsync(data);

    const issues = [];

    // ------------------------------------------------------------
    // Collect root-level entries
    // ------------------------------------------------------------
    const rootEntries = new Set();
    zip.forEach((entryName, entry) => {
      const parts = entryName.split("/");
      if (parts.length === 1 || (parts.length === 2 && parts[1] === "")) {
        rootEntries.add(parts[0]);
      }
    });

    // Required root file
    if (!rootEntries.has("system.json")) {
      issues.push("Missing system.json at ZIP root");
    }

    // Allowed root folders
    const allowed = new Set([
      "module",
      "scripts",
      "styles",
      "templates",
      "packs",
      "lang",
      "assets",
      "system.json"
    ]);

    for (const entry of rootEntries) {
      if (!allowed.has(entry)) {
        issues.push(`Unexpected top-level entry: ${entry}`);
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (issues.length > 0) {
      console.log("❌ validate-zip-structure found issues:\n");
      for (const issue of issues) console.log(" - " + issue);
      if (strict) throw new Error("ZIP structure validation failed");
    } else {
      console.log("✔ validate-zip-structure passed");
    }
  } catch (err) {
    console.log("⚠ validate-zip-structure encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
