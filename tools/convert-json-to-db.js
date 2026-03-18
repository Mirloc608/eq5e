// EQ5e Tool — Auto‑Generated Header

// tools/convert-json-to-db.js
// Converts EQ5e JSON packs into Foundry-compatible .db NDJSON files.

export default async function convertJsonToDb({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");
  const crypto = await import("node:crypto");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const packsDir = path.join(root, "packs");
    const outDir = path.join(root, "packs-db");

    if (!fs.existsSync(packsDir)) {
      console.log("⚠ No packs directory found, skipping convert-json-to-db");
      return;
    }

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir);
    }

    const files = fs.readdirSync(packsDir).filter(f => f.endsWith(".json"));

    for (const file of files) {
      const inPath = path.join(packsDir, file);
      const outPath = path.join(outDir, file.replace(".json", ".db"));

      const raw = JSON.parse(fs.readFileSync(inPath, "utf8"));

      // Your pack format: { name, label, entries: [...] }
      const entries = Array.isArray(raw.entries) ? raw.entries : [];

      const lines = entries.map(entry => {
        if (!entry._id) {
          entry._id = crypto.randomUUID();
        }
        return JSON.stringify(entry);
      });

      fs.writeFileSync(outPath, lines.join("\n") + "\n");

      console.log(`✔ Converted ${file} → ${path.basename(outPath)}`);
    }
  } catch (err) {
    console.log("⚠ convert-json-to-db encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
