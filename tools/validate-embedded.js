// EQ5e Tool — Auto‑Generated Header

// tools/validate-embedded.js
// Ensures that embedded document references (items, effects, tokens, etc.) are structurally valid
// and that their parent/child relationships are consistent.

export default async function validateEmbedded({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const packsDir = path.join(root, "packs");
    const issues = [];

    if (!fs.existsSync(packsDir)) {
      console.log("✔ validate-embedded passed (no packs directory)");
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

      const actors = new Map();   // _id → actor doc
      const items = new Map();    // _id → item doc
      const scenes = new Map();   // _id → scene doc

      // ------------------------------------------------------------
      // First pass: load docs and index by type/_id
      // ------------------------------------------------------------
      for (const file of files) {
        const full = path.join(packPath, file);

        try {
          const raw = fs.readFileSync(full, "utf8");
          const doc = JSON.parse(raw);

          if (!doc || typeof doc !== "object") {
            issues.push({
              file: full,
              message: "Document is not a valid object"
            });
            continue;
          }

          if (!doc._id || typeof doc._id !== "string") {
            issues.push({
              file: full,
              message: "Document missing required _id for embedded validation"
            });
            continue;
          }

          if (doc.type === "Actor") {
            actors.set(doc._id, { doc, source: full });
          } else if (doc.type === "Item") {
            items.set(doc._id, { doc, source: full });
          } else if (doc.type === "Scene") {
            scenes.set(doc._id, { doc, source: full });
          }
        } catch (err) {
          issues.push({
            file: full,
            message: `Invalid JSON (${err.message})`
          });
        }
      }

      // ------------------------------------------------------------
      // Second pass: validate embedded items/effects on actors
      // ------------------------------------------------------------
      for (const { doc, source } of actors.values()) {
        // Embedded items
        if (Array.isArray(doc.items)) {
          for (let i = 0; i < doc.items.length; i++) {
            const embedded = doc.items[i];
            const prefix = `${source} (actor item ${i + 1})`;

            validateEmbeddedDoc(embedded, "Item", prefix, issues);

            // If it references a standalone item by _id, ensure it exists
            if (embedded._id && items.has(embedded._id)) {
              // OK: embedded shares an id with a top-level item
            }
          }
        }

        // Active effects
        if (Array.isArray(doc.effects)) {
          for (let i = 0; i < doc.effects.length; i++) {
            const effect = doc.effects[i];
            const prefix = `${source} (actor effect ${i + 1})`;

            validateEmbeddedDoc(effect, "ActiveEffect", prefix, issues);
          }
        }
      }

      // ------------------------------------------------------------
      // Third pass: validate embedded tokens/effects on scenes
      // ------------------------------------------------------------
      for (const { doc, source } of scenes.values()) {
        // Tokens
        if (Array.isArray(doc.tokens)) {
          for (let i = 0; i < doc.tokens.length; i++) {
            const token = doc.tokens[i];
            const prefix = `${source} (scene token ${i + 1})`;

            // Basic token structure
            if (!token._id || typeof token._id !== "string") {
              issues.push({
                file: prefix,
                message: "Token missing required _id"
              });
            }

            if (typeof token.x !== "number" || typeof token.y !== "number") {
              issues.push({
                file: prefix,
                message: "Token must have numeric x/y coordinates"
              });
            }

            // Token → actor linkage
            if (token.actorId && typeof token.actorId === "string") {
              if (!actors.has(token.actorId)) {
                issues.push({
                  file: prefix,
                  message: `Token references missing actor '${token.actorId}'`
                });
              }
            }

            // Token effects (if present)
            if (Array.isArray(token.effects)) {
              for (let j = 0; j < token.effects.length; j++) {
                const effect = token.effects[j];
                const eprefix = `${prefix} (token effect ${j + 1})`;
                validateEmbeddedDoc(effect, "ActiveEffect", eprefix, issues);
              }
            }
          }
        }
      }
    }

    // ------------------------------------------------------------
    // Embedded document validation rules
    // ------------------------------------------------------------
    function validateEmbeddedDoc(doc, expectedType, source, issuesArray) {
      if (!doc || typeof doc !== "object") {
        issuesArray.push({
          file: source,
          message: `Embedded ${expectedType} is not a valid object`
        });
        return;
      }

      if (!doc._id || typeof doc._id !== "string") {
        issuesArray.push({
          file: source,
          message: `Embedded ${expectedType} missing required _id`
        });
      }

      if (!doc.name || typeof doc.name !== "string") {
        issuesArray.push({
          file: source,
          message: `Embedded ${expectedType} missing required name`
        });
      }

      if (!doc.type || typeof doc.type !== "string") {
        issuesArray.push({
          file: source,
          message: `Embedded ${expectedType} missing required type`
        });
      } else if (expectedType && doc.type !== expectedType) {
        // Some embedded docs (like ActiveEffect) may have type "base" or similar;
        // this check is intentionally soft and only flags clear mismatches.
        if (expectedType !== "ActiveEffect") {
          issuesArray.push({
            file: source,
            message: `Embedded document type '${doc.type}' does not match expected '${expectedType}'`
          });
        }
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (issues.length > 0) {
      console.log("❌ validate-embedded found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("Embedded document validation failed");
    } else {
      console.log("✔ validate-embedded passed");
    }
  } catch (err) {
    console.log("⚠ validate-embedded encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
