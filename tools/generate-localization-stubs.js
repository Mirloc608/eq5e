// EQ5e Tool — Auto‑Generated Header

// tools/generate-localization-stubs.js
// Scans the repo for localization keys and generates missing stubs in lang/en.json.

export default async function generateLocalizationStubs({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const langFile = path.join(root, "lang", "en.json");

    // Load existing localization file
    let existing = {};
    if (fs.existsSync(langFile)) {
      existing = JSON.parse(fs.readFileSync(langFile, "utf8"));
    }

    // Collect all .js and .html files
    function walk(dir) {
      const out = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (entry.isFile() && (full.endsWith(".js") || full.endsWith(".html"))) {
          out.push(full);
        }
      }
      return out;
    }

    const files = walk(root);

    // Regex patterns for localization keys
    const patterns = [
      /game\.i18n\.localize\(["'`](.*?)["'`]\)/g,
      /game\.i18n\.format\(["'`](.*?)["'`]/g,
      /\{\{\s*localize\s+["'`](.*?)["'`]\s*\}\}/g
    ];

    const found = new Set();

    // Extract keys
    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          found.add(match[1]);
        }
      }
    }

    // Merge with existing
    let output = { ...existing };
    let added = 0;

    for (const key of found) {
      if (!(key in output)) {
        output[key] = "";
        added++;
        console.log(`🆕 Added missing localization key: ${key}`);
      }
    }

    // Sort alphabetically
    const sorted = Object.keys(output)
      .sort()
      .reduce((obj, key) => {
        obj[key] = output[key];
        return obj;
      }, {});

    // Write back
    fs.writeFileSync(langFile, JSON.stringify(sorted, null, 2));

    if (added > 0) {
      console.log(`✔ generate-localization-stubs added ${added} new keys`);
    } else {
      console.log("✔ generate-localization-stubs passed");
    }
  } catch (err) {
    console.log("⚠ generate-localization-stubs encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
