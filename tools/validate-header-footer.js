// EQ5e Tool — Auto‑Generated Header

// tools/validate-header-footer.js
// Ensures that all system JS files contain the canonical EQ5e header and footer.

export default async function validateHeaderFooter({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const JS_EXT = ".js";
    const issues = [];

    const HEADER = "// EQ5e Tool — Auto‑Generated Header";
    const FOOTER = "// End of EQ5e Tool";

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

      if (first !== HEADER) {
        issues.push({
          file: filePath,
          message: "Missing or incorrect EQ5e header"
        });
      }

      if (last !== FOOTER) {
        issues.push({
          file: filePath,
          message: "Missing or incorrect EQ5e footer"
        });
      }
    }

    for (const dir of SCAN_DIRS) {
      const full = path.join(root, dir);
      if (fs.existsSync(full)) walk(full);
    }

    if (issues.length > 0) {
      console.log("❌ validate-header-footer found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("Header/footer validation failed");
    } else {
      console.log("✔ validate-header-footer passed");
    }
  } catch (err) {
    console.log("⚠ validate-header-footer encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
