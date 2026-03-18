// EQ5e Tool — Auto‑Generated Header

// tools/validate-file-naming.js
// Ensures that all system JS files follow lowercase-with-dashes.js naming rules.

export default async function validateFileNaming({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

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
        } else if (entry.isFile()) {
          validateName(full, entry.name);
        }
      }
    }

    function validateName(filePath, name) {
      // Skip non-JS files
      if (!name.endsWith(".js")) {
        issues.push({
          file: filePath,
          message: "File must end with .js"
        });
        return;
      }

      // Strip extension
      const base = name.slice(0, -3);

      // Rule: lowercase only
      if (/[A-Z]/.test(base)) {
        issues.push({
          file: filePath,
          message: "Filename contains uppercase letters"
        });
      }

      // Rule: no spaces
      if (base.includes(" ")) {
        issues.push({
          file: filePath,
          message: "Filename contains spaces"
        });
      }

      // Rule: only lowercase letters, numbers, and dashes
      for (const ch of base) {
        const ok =
          (ch >= "a" && ch <= "z") ||
          (ch >= "0" && ch <= "9") ||
          ch === "-";

        if (!ok) {
          issues.push({
            file: filePath,
            message: `Invalid character '${ch}' in filename`
          });
          break;
        }
      }
    }

    for (const dir of SCAN_DIRS) {
      const full = path.join(root, dir);
      if (fs.existsSync(full)) walk(full);
    }

    if (issues.length > 0) {
      console.log("❌ validate-file-naming found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("File naming validation failed");
    } else {
      console.log("✔ validate-file-naming passed");
    }
  } catch (err) {
    console.log("⚠ validate-file-naming encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
