// EQ5e Tool — Auto‑Generated Header

// tools/validate-images.js
// Ensures that all image paths referenced in the system exist and use valid extensions.

export default async function validateImages({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const issues = [];

    const ALLOWED_EXT = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

    // ------------------------------------------------------------
    // Helper: validate a single image path
    // ------------------------------------------------------------
    function checkImage(imgPath, source) {
      if (!imgPath || typeof imgPath !== "string") return;

      const ext = path.extname(imgPath).toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) {
        issues.push({
          file: source,
          message: `Invalid image extension '${ext}' for ${imgPath}`
        });
      }

      const full = path.join(root, imgPath);
      if (!fs.existsSync(full)) {
        issues.push({
          file: source,
          message: `Missing image file: ${imgPath}`
        });
      }
    }

    // ------------------------------------------------------------
    // 1. Validate images in system.json
    // ------------------------------------------------------------
    const systemPath = path.join(root, "system.json");
    if (fs.existsSync(systemPath)) {
      try {
        const raw = fs.readFileSync(systemPath, "utf8");
        const system = JSON.parse(raw);

        function walk(obj, source) {
          if (!obj || typeof obj !== "object") return;
          for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (typeof val === "string" && key.toLowerCase().includes("img")) {
              checkImage(val, source);
            } else if (typeof val === "string" && key.toLowerCase().includes("icon")) {
              checkImage(val, source);
            } else if (typeof val === "object") {
              walk(val, source);
            }
          }
        }

        walk(system, systemPath);
      } catch (err) {
        issues.push({
          file: systemPath,
          message: `Invalid system.json (${err.message})`
        });
      }
    }

    // ------------------------------------------------------------
    // 2. Validate images in packs
    // ------------------------------------------------------------
    const packsDir = path.join(root, "packs");
    if (fs.existsSync(packsDir)) {
      const packFolders = fs
        .readdirSync(packsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      for (const folder of packFolders) {
        const packPath = path.join(packsDir, folder);
        const files = fs
          .readdirSync(packPath)
          .filter(f => f.endsWith(".json") && f !== "metadata.json");

        for (const file of files) {
          const full = path.join(packPath, file);

          try {
            const raw = fs.readFileSync(full, "utf8");
            const doc = JSON.parse(raw);

            function walkDoc(obj, source) {
              if (!obj || typeof obj !== "object") return;
              for (const key of Object.keys(obj)) {
                const val = obj[key];
                if (typeof val === "string" && key.toLowerCase().includes("img")) {
                  checkImage(val, source);
                } else if (typeof val === "object") {
                  walkDoc(val, source);
                }
              }
            }

            walkDoc(doc, full);
          } catch (err) {
            issues.push({
              file: full,
              message: `Invalid JSON (${err.message})`
            });
          }
        }
      }
    }

    // ------------------------------------------------------------
    // 3. Validate inline image references in system code
    // ------------------------------------------------------------
    const SCAN_DIRS = ["module", "scripts", "src"];

    function walkCode(dir) {
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
          walkCode(full);
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

        // Look for img: "path/to/file.png"
        const idx = line.indexOf("img:");
        if (idx === -1) continue;

        const quote = line.includes('"') ? '"' : line.includes("'") ? "'" : null;
        if (!quote) continue;

        const start = line.indexOf(quote, idx);
        const end = line.indexOf(quote, start + 1);
        if (start === -1 || end === -1) continue;

        const imgPath = line.slice(start + 1, end);
        checkImage(imgPath, `${filePath}:${i + 1}`);
      }
    }

    for (const dir of SCAN_DIRS) {
      const full = path.join(root, dir);
      if (fs.existsSync(full)) walkCode(full);
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (issues.length > 0) {
      console.log("❌ validate-images found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("Image validation failed");
    } else {
      console.log("✔ validate-images passed");
    }
  } catch (err) {
    console.log("⚠ validate-images encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
