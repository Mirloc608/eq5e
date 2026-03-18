// EQ5e Tool — Auto‑Generated Header

// tools/fix-headers-footers.js
// Inserts the canonical EQ5e header and footer into all system JS files
// that are missing them. Safe, deterministic, and ESM‑pure.

export default async function fixHeadersFooters({ strict = false } = {}) {
  const fs = await import("node:fs");
  const fsp = await import("node:fs/promises");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const TARGET_DIRS = ["module", "scripts", "src"];

    const HEADER = "// EQ5e System — Auto‑Generated Header";
    const FOOTER = "// End of EQ5e System";

    const JS_EXT = ".js";

    const issues = [];

    // ------------------------------------------------------------
    // Walk directories
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
        if (entry.isFile() && entry.name.endsWith(JS_EXT)) {
          await processFile(full);
        }
      }
    }

    // ------------------------------------------------------------
    // Insert header/footer if missing
    // ------------------------------------------------------------
    async function processFile(filePath) {
      const raw = await fsp.readFile(filePath, "utf8");
      const lines = raw.split("\n");

      // Find first non-empty line
      let first = null;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
          first = trimmed;
          break;
        }
      }

      // Find last non-empty line
      let last = null;
      for (let i = lines.length - 1; i >= 0; i--) {
        const trimmed = lines[i].trim();
        if (trimmed.length > 0) {
          last = trimmed;
          break;
        }
      }

      const needsHeader = first !== HEADER;
      const needsFooter = last !== FOOTER;

      if (!needsHeader && !needsFooter) return;

      let output = raw;

      if (needsHeader) {
        output = HEADER + "\n\n" + output;
      }

      if (needsFooter) {
        if (!output.endsWith("\n")) output += "\n";
        output += FOOTER + "\n";
      }

      await fsp.writeFile(filePath, output, "utf8");

      issues.push({
        file: filePath,
        message: `Inserted ${needsHeader ? "header" : ""}${needsHeader && needsFooter ? " and " : ""}${needsFooter ? "footer" : ""}`
      });
    }

    // ------------------------------------------------------------
    // Run on all target directories
    // ------------------------------------------------------------
    for (const dir of TARGET_DIRS) {
      const full = path.join(root, dir);
      if (fs.existsSync(full)) {
        await walk(full);
      }
    }

    // ------------------------------------------------------------
    // Report
    // ------------------------------------------------------------
    if (issues.length > 0) {
      console.log("✔ fix-headers-footers updated files:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
    } else {
      console.log("✔ fix-headers-footers found no files to update");
    }
  } catch (err) {
    console.log("⚠ fix-headers-footers encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e System
