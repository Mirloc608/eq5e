// EQ5e Tool — Auto‑Generated Header

// tools/validate-scenes.js
// Ensures that all Scene documents in packs are valid and structurally complete.

export default async function validateScenes({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const issues = [];

    // ------------------------------------------------------------
    // Scan packs for scene documents
    // ------------------------------------------------------------
    const packsDir = path.join(root, "packs");
    if (!fs.existsSync(packsDir)) {
      console.log("✔ validate-scenes passed (no packs directory)");
      return;
    }

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

          if (doc.type === "Scene") {
            validateScene(doc, full);
          }
        } catch (err) {
          issues.push({
            file: full,
            message: `Invalid JSON (${err.message})`
          });
        }
      }
    }

    // ------------------------------------------------------------
    // Scene validation rules
    // ------------------------------------------------------------
    function validateScene(doc, source) {
      if (!doc.name || typeof doc.name !== "string") {
        issues.push({
          file: source,
          message: "Scene missing required field: name"
        });
      }

      if (typeof doc.width !== "number" || typeof doc.height !== "number") {
        issues.push({
          file: source,
          message: "Scene missing required numeric width/height"
        });
      }

      // Background image
      const bg = doc.background ?? {};
      if (!bg.src || typeof bg.src !== "string") {
        issues.push({
          file: source,
          message: "Scene missing required background.src"
        });
      } else {
        const full = path.join(root, bg.src);
        if (!fs.existsSync(full)) {
          issues.push({
            file: source,
            message: `Missing background image: ${bg.src}`
          });
        }
      }

      // Walls
      if (Array.isArray(doc.walls)) {
        for (let i = 0; i < doc.walls.length; i++) {
          const w = doc.walls[i];
          const prefix = `${source} (wall ${i + 1})`;

          if (!Array.isArray(w.c) || w.c.length !== 4) {
            issues.push({
              file: prefix,
              message: "Wall must have coordinate array c: [x1, y1, x2, y2]"
            });
          }
        }
      }

      // Lights
      if (Array.isArray(doc.lights)) {
        for (let i = 0; i < doc.lights.length; i++) {
          const l = doc.lights[i];
          const prefix = `${source} (light ${i + 1})`;

          if (typeof l.x !== "number" || typeof l.y !== "number") {
            issues.push({
              file: prefix,
              message: "Light must have numeric x/y coordinates"
            });
          }
        }
      }

      // Tokens
      if (Array.isArray(doc.tokens)) {
        for (let i = 0; i < doc.tokens.length; i++) {
          const t = doc.tokens[i];
          const prefix = `${source} (token ${i + 1})`;

          if (!t.name || typeof t.name !== "string") {
            issues.push({
              file: prefix,
              message: "Token missing required field: name"
            });
          }

          if (typeof t.x !== "number" || typeof t.y !== "number") {
            issues.push({
              file: prefix,
              message: "Token must have numeric x/y coordinates"
            });
          }
        }
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (issues.length > 0) {
      console.log("❌ validate-scenes found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("Scene validation failed");
    } else {
      console.log("✔ validate-scenes passed");
    }
  } catch (err) {
    console.log("⚠ validate-scenes encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
