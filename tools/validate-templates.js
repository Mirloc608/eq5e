// EQ5e Tool — Auto‑Generated Header

// tools/validate-templates.js
// Ensures that all template paths referenced in the system exist and use valid extensions.

export default async function validateTemplates({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const issues = [];
    const ALLOWED_EXT = [".html"];

    // ------------------------------------------------------------
    // Helper: validate a single template path
    // ------------------------------------------------------------
    function checkTemplate(templatePath, source) {
      if (!templatePath || typeof templatePath !== "string") return;

      const ext = path.extname(templatePath).toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) {
        issues.push({
          file: source,
          message: `Invalid template extension '${ext}' for ${templatePath}`
        });
      }

      const full = path.join(root, templatePath);
      if (!fs.existsSync(full)) {
        issues.push({
          file: source,
          message: `Missing template file: ${templatePath}`
        });
      }
    }

    // ------------------------------------------------------------
    // 1. Validate templates in system.json
    // ------------------------------------------------------------
    const systemPath = path.join(root, "system.json");
    if (fs.existsSync(systemPath)) {
      try {
        const raw = fs.readFileSync(systemPath, "utf8");
        const system = JSON.parse(raw);

        // system.templates
        if (system.templates && typeof system.templates === "object") {
          for (const key of Object.keys(system.templates)) {
            checkTemplate(system.templates[key], systemPath);
          }
        }

        // sheet templates
        const sheetGroups = ["Actor", "Item"];
        for (const group of sheetGroups) {
          const sheets = system.sheets?.[group] ?? {};
          for (const type of Object.keys(sheets)) {
            const tpl = sheets[type]?.template;
            if (tpl) checkTemplate(tpl, systemPath);
          }
        }
      } catch (err) {
        issues.push({
          file: systemPath,
          message: `Invalid system.json (${err.message})`
        });
      }
    }

    // ------------------------------------------------------------
    // 2. Validate inline template references in system code
    // ------------------------------------------------------------
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
        } else if (entry.isFile() && entry.name.endsWith(".js")) {
          scanFile(full);
        }
      }
    }

    function scanFile(filePath) {
      const raw = fs.readFileSync(filePath, "utf8");
      const lines = raw.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Look for template: "path/to/template.html"
        const idx = line.indexOf("template:");
        if (idx === -1) continue;

        const quote = line.includes('"') ? '"' : line.includes("'") ? "'" : null;
        if (!quote) continue;

        const start = line.indexOf(quote, idx);
        const end = line.indexOf(quote, start + 1);
        if (start === -1 || end === -1) continue;

        const templatePath = line.slice(start + 1, end);
        checkTemplate(templatePath, `${filePath}:${i + 1}`);
      }
    }

    for (const dir of SCAN_DIRS) {
      const full = path.join(root, dir);
      if (fs.existsSync(full)) walk(full);
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (issues.length > 0) {
      console.log("❌ validate-templates found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("Template validation failed");
    } else {
      console.log("✔ validate-templates passed");
    }
  } catch (err) {
    console.log("⚠ validate-templates encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
