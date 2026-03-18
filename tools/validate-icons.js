// EQ5e Tool — Auto‑Generated Header

// tools/validate-icons.js
// Ensures that all icon paths referenced in the system exist and use valid extensions.

export default async function validateIcons({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const issues = [];
    const ALLOWED_EXT = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

    // ------------------------------------------------------------
    // Helper: validate a single icon path
    // ------------------------------------------------------------
    function checkIcon(iconPath, source) {
      if (!iconPath || typeof iconPath !== "string") return;

      const ext = path.extname(iconPath).toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) {
        issues.push({
          file: source,
          message: `Invalid icon extension '${ext}' for ${iconPath}`
        });
      }

      const full = path.join(root, iconPath);
      if (!fs.existsSync(full)) {
        issues.push({
          file: source,
          message: `Missing icon file: ${iconPath}`
        });
      }
    }

    // ------------------------------------------------------------
    // 1. Validate icons in system.json
    // ------------------------------------------------------------
    const systemPath = path.join(root, "system.json");
    if (fs.existsSync(systemPath)) {
      try {
        const raw = fs.readFileSync(systemPath, "utf8");
        const system = JSON.parse(raw);

        // system.icons
        if (system.icons && typeof system.icons === "object") {
          for (const key of Object.keys(system.icons)) {
            checkIcon(system.icons[key], systemPath);
          }
        }

        // sheet icons
        const sheetGroups = ["Actor", "Item"];
        for (const group of sheetGroups) {
          const sheets = system.sheets?.[group] ?? {};
          for (const type of Object.keys(sheets)) {
            const icon = sheets[type]?.icon;
            if (icon) checkIcon(icon, systemPath);
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
    // 2. Validate inline icon references in system code
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

        // Look for icon: "path/to/icon.png"
        const idx = line.indexOf("icon:");
        if (idx === -1) continue;

        const quote = line.includes('"') ? '"' : line.includes("'") ? "'" : null;
        if (!quote) continue;

        const start = line.indexOf(quote, idx);
        const end = line.indexOf(quote, start + 1);
        if (start === -1 || end === -1) continue;

        const iconPath = line.slice(start + 1, end);
        checkIcon(iconPath, `${filePath}:${i + 1}`);
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
      console.log("❌ validate-icons found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("Icon validation failed");
    } else {
      console.log("✔ validate-icons passed");
    }
  } catch (err) {
    console.log("⚠ validate-icons encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
