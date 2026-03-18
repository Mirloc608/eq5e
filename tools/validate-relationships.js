// EQ5e Tool — Auto‑Generated Header

// tools/validate-relationships.js
// Ensures that all cross-document references (actor → items, scene → tokens, etc.)
// point to valid documents of the correct type, and that no orphaned or circular
// relationships exist.

export default async function validateRelationships({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const packsDir = path.join(root, "packs");
    const issues = [];

    if (!fs.existsSync(packsDir)) {
      console.log("✔ validate-relationships passed (no packs directory)");
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

      // Index documents by type and id
      const actors = new Map();
      const items = new Map();
      const scenes = new Map();

      // ------------------------------------------------------------
      // First pass: load all documents
      // ------------------------------------------------------------
      for (const file of files) {
        const full = path.join(packPath, file);

        let doc = null;
        try {
          const raw = fs.readFileSync(full, "utf8");
          doc = JSON.parse(raw);
        } catch (err) {
          issues.push({
            file: full,
            message: `Invalid JSON (${err.message})`
          });
          continue;
        }

        if (!doc || typeof doc !== "object") continue;
        if (!doc._id || typeof doc._id !== "string") continue;

        if (doc.type === "Actor") actors.set(doc._id, { doc, source: full });
        if (doc.type === "Item") items.set(doc._id, { doc, source: full });
        if (doc.type === "Scene") scenes.set(doc._id, { doc, source: full });
      }

      // ------------------------------------------------------------
      // Validate Actor → Item / Effect relationships
      // ------------------------------------------------------------
      for (const { doc, source } of actors.values()) {
        // Embedded items
        if (Array.isArray(doc.items)) {
          for (let i = 0; i < doc.items.length; i++) {
            const embedded = doc.items[i];
            const prefix = `${source} (actor item ${i + 1})`;

            if (embedded._id && items.has(embedded._id)) {
              // OK: embedded references a top-level item
            } else if (embedded._id && !items.has(embedded._id)) {
              issues.push({
                file: prefix,
                message: `Actor references missing item '${embedded._id}'`
              });
            }
          }
        }

        // Embedded effects
        if (Array.isArray(doc.effects)) {
          for (let i = 0; i < doc.effects.length; i++) {
            const effect = doc.effects[i];
            const prefix = `${source} (actor effect ${i + 1})`;

            if (!effect._id || typeof effect._id !== "string") {
              issues.push({
                file: prefix,
                message: "Effect missing required _id"
              });
            }
          }
        }
      }

      // ------------------------------------------------------------
      // Validate Item → Item (containers, attachments)
      // ------------------------------------------------------------
      for (const { doc, source } of items.values()) {
        if (doc.parent && typeof doc.parent === "string") {
          if (!items.has(doc.parent)) {
            issues.push({
              file: source,
              message: `Item references missing parent item '${doc.parent}'`
            });
          }
        }
      }

      // ------------------------------------------------------------
      // Validate Scene → Token → Actor relationships
      // ------------------------------------------------------------
      for (const { doc, source } of scenes.values()) {
        if (!Array.isArray(doc.tokens)) continue;

        for (let i = 0; i < doc.tokens.length; i++) {
          const token = doc.tokens[i];
          const prefix = `${source} (scene token ${i + 1})`;

          if (token.actorId && typeof token.actorId === "string") {
            if (!actors.has(token.actorId)) {
              issues.push({
                file: prefix,
                message: `Token references missing actor '${token.actorId}'`
              });
            }
          }

          // Token → embedded items
          if (Array.isArray(token.items)) {
            for (let j = 0; j < token.items.length; j++) {
              const embedded = token.items[j];
              const eprefix = `${prefix} (token item ${j + 1})`;

              if (embedded._id && items.has(embedded._id)) {
                // OK
              } else if (embedded._id) {
                issues.push({
                  file: eprefix,
                  message: `Token references missing item '${embedded._id}'`
                });
              }
            }
          }
        }
      }

      // ------------------------------------------------------------
      // Detect circular parent chains in items
      // ------------------------------------------------------------
      for (const { doc, source } of items.values()) {
        const visited = new Set();
        let current = doc;

        while (current && current.parent) {
          if (visited.has(current._id)) {
            issues.push({
              file: source,
              message: `Circular parent chain detected for item '${doc._id}'`
            });
            break;
          }

          visited.add(current._id);

          const parent = items.get(current.parent);
          if (!parent) break;
          current = parent.doc;
        }
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (issues.length > 0) {
      console.log("❌ validate-relationships found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("Relationship validation failed");
    } else {
      console.log("✔ validate-relationships passed");
    }
  } catch (err) {
    console.log("⚠ validate-relationships encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
