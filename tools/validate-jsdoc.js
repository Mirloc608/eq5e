// EQ5e Tool — Auto‑Generated Header

// tools/validate-jsdoc.js
// Ensures that exported functions and classes have proper JSDoc blocks.

export default async function validateJsdoc({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const JS_EXT = ".js";
    const issues = [];

    // Only system code — tools are excluded
    const SCAN_DIRS = ["module", "scripts", "src"];

    function walk(dir) {
      const base = path.basename(dir);

      if (
        base === "node_modules" ||
        base === "dist" ||
        base === "packs" ||
        base === "tests"
      ) {
        return;
      }

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && entry.name.endsWith(JS_EXT)) {
          scanFile(full);
        }
      }
    }

    function scanFile(filePath) {
      const raw = fs.readFileSync(filePath, "utf8");
      const lines = raw.split("\n");

      let lastJsdoc = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Detect start of JSDoc
        if (line.startsWith("/**")) {
          lastJsdoc = { start: i, empty: true };
          continue;
        }

        // Detect end of JSDoc
        if (lastJsdoc && line.endsWith("*/")) {
          // If there's anything between /** and */, it's not empty
          if (i > lastJsdoc.start) lastJsdoc.empty = false;
          continue;
        }

        // Detect export declarations
        const isExportFunc = line.startsWith("export function ");
        const isExportClass = line.startsWith("export class ");

        if (isExportFunc || isExportClass) {
          if (!lastJsdoc) {
            issues.push({
              file: filePath,
              line: i + 1,
              message: "Missing JSDoc block above exported declaration"
            });
          } else {
            if (lastJsdoc.empty) {
              issues.push({
                file: filePath,
                line: lastJsdoc.start + 1,
                message: "Empty JSDoc block"
              });
            }

            // JSDoc must be directly above the declaration
            if (lastJsdoc.start < i - 1) {
              issues.push({
                file: filePath,
                line: i + 1,
                message: "JSDoc block must be immediately above exported declaration"
              });
            }
          }

          lastJsdoc = null;
        }

        // Reset JSDoc if we hit any other code
        if (line.length > 0 && !line.startsWith("*") && !line.startsWith("/")) {
          lastJsdoc = null;
        }
      }
    }

    for (const dir of SCAN_DIRS) {
      const full = path.join(root, dir);
      if (fs.existsSync(full)) walk(full);
    }

    if (issues.length > 0) {
      console.log("❌ validate-jsdoc found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file}:${issue.line} → ${issue.message}`);
      }
      if (strict) throw new Error("JSDoc validation failed");
    } else {
      console.log("✔ validate-jsdoc passed");
    }
  } catch (err) {
    console.log("⚠ validate-jsdoc encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
