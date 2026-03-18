// EQ5e Tool — Auto‑Generated Header

// tools/sort-imports.js
// Reports JS files whose import statements are not alphabetically sorted.

export default async function sortImports({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const JS_EXT = ".js";
    const outOfOrder = [];

    function walk(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.endsWith(JS_EXT)) checkFile(full);
      }
    }

    function checkFile(filePath) {
      const src = fs.readFileSync(filePath, "utf8");
      const lines = src.split("\n");

      const importLines = [];
      const otherLines = [];

      for (const line of lines) {
        if (/^\s*import\s+/.test(line)) importLines.push(line);
        else otherLines.push(line);
      }

      if (importLines.length <= 1) return;

      const sorted = [...importLines].sort((a, b) => a.localeCompare(b));

      const identical =
        importLines.length === sorted.length &&
        importLines.every((line, i) => line === sorted[i]);

      if (!identical) {
        outOfOrder.push(filePath);
      }
    }

    walk(root);

    if (outOfOrder.length > 0) {
      console.log("❌ sort-imports found unsorted import blocks:\n");
      for (const f of outOfOrder) {
        console.log(" - " + path.relative(root, f));
      }
      if (strict) throw new Error("Import order validation failed");
    } else {
      console.log("✔ sort-imports passed");
    }
  } catch (err) {
    console.log("⚠ sort-imports encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
