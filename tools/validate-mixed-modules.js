// EQ5e Tool — Auto‑Generated Header

// tools/validate-mixed-modules.js
// Ensures that no system JS file mixes ESM and CommonJS module systems.

export default async function validateMixedModules({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const JS_EXT = ".js";
    const issues = [];

    // Only system code — tools are allowed to use createRequire()
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

    // State-machine-based noise stripper
    function stripNoise(line) {
      let out = "";
      let i = 0;
      let state = "code";
      let stringChar = null;

      while (i < line.length) {
        const c = line[i];
        const next = line[i + 1];

        if (state === "block") {
          if (c === "*" && next === "/") {
            state = "code";
            i += 2;
            continue;
          }
          i++;
          continue;
        }

        if (state === "code" && c === "/" && next === "*") {
          state = "block";
          i += 2;
          continue;
        }

        if (state === "code" && c === "/" && next === "/") break;

        if (state === "code" && (c === '"' || c === "'")) {
          state = "string";
          stringChar = c;
          i++;
          continue;
        }

        if (state === "code" && c === "`") {
          state = "template";
          i++;
          continue;
        }

        if (state === "code" && c === "/" && next !== "/" && next !== "*") {
          state = "regex";
          i++;
          continue;
        }

        if (state === "string" && c === stringChar && line[i - 1] !== "\\") {
          state = "code";
          i++;
          continue;
        }

        if (state === "template" && c === "`" && line[i - 1] !== "\\") {
          state = "code";
          i++;
          continue;
        }

        if (state === "regex" && c === "/" && line[i - 1] !== "\\") {
          state = "code";
          i++;
          continue;
        }

        if (state === "code") out += c;

        i++;
      }

      return out.trim();
    }

    function scanFile(filePath) {
      const raw = fs.readFileSync(filePath, "utf8");
      const lines = raw.split("\n");

      let hasImport = false;
      let hasExport = false;
      let hasRequire = false;
      let hasModuleExports = false;
      let hasExportsDot = false;

      for (let i = 0; i < lines.length; i++) {
        const clean = stripNoise(lines[i]);
        if (!clean) continue;

        if (clean.startsWith("import ")) hasImport = true;
        if (clean.startsWith("export ")) hasExport = true;
        if (/\brequire\s*\(/.test(clean)) hasRequire = true;
        if (clean.includes("module.exports")) hasModuleExports = true;
        if (clean.includes("exports.")) hasExportsDot = true;
      }

      // Mixed module patterns
      if (hasImport && (hasRequire || hasModuleExports || hasExportsDot)) {
        issues.push({
          file: filePath,
          message: "File mixes ESM import with CommonJS require/exports"
        });
      }

      if (hasExport && (hasRequire || hasModuleExports || hasExportsDot)) {
        issues.push({
          file: filePath,
          message: "File mixes ESM export with CommonJS require/exports"
        });
      }
    }

    for (const dir of SCAN_DIRS) {
      const full = path.join(root, dir);
      if (fs.existsSync(full)) walk(full);
    }

    if (issues.length > 0) {
      console.log("❌ validate-mixed-modules found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("Mixed module validation failed");
    } else {
      console.log("✔ validate-mixed-modules passed");
    }
  } catch (err) {
    console.log("⚠ validate-mixed-modules encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
