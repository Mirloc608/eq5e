// EQ5e Tool — Auto‑Generated Header

// tools/fix-import-order.js
// Auto‑sorts import statements alphabetically in all .js files.

export default async function fixImportOrder({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const JS_EXT = ".js";
    const changedFiles = [];

    function walk(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.endsWith(JS_EXT)) processFile(full);
      }
    }

    function processFile(filePath) {
      let src = fs.readFileSync(filePath, "utf8");
      const lines = src.split("\n");

      const importLines = [];
      const otherLines = [];

      // Separate import lines from the rest
      for (const line of lines) {
        if (/^\s*import\s+/.test(line)) {
          importLines.push(line);
        } else {
          otherLines.push(line);
        }
      }

      if (importLines.length <= 1) return; // nothing to sort

      const sorted = [...importLines].sort((a, b) => a.localeCompare(b));

      const identical =
        importLines.length === sorted.length &&
        importLines.every((line, i) => line === sorted[i]);

      if (identical) return;

      const newSrc = [...sorted, ...otherLines].join("\n");

      fs.writeFileSync(filePath, newSrc);
      changedFiles.push(filePath);
    }

    walk(root);

    if (changedFiles.length > 0) {
      console.log("✔ fix-import-order updated:");
      for (const f of changedFiles) {
        console.log(" - " + path.relative(root, f));
      }
    } else {
      console.log("✔ fix-import-order passed");
    }
  } catch (err) {
    console.log("⚠ fix-import-order encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
