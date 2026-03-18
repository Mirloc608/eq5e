// EQ5e Tool — Auto‑Generated Header

// tools/validate-templates-missing.js
// Ensures that all template files referenced in system.json or via {{> partial}}
// exist and are valid, and detects missing or circular partial includes.

export default async function validateTemplatesMissing({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const templatesDir = path.join(root, "templates");
    const issues = [];

    if (!fs.existsSync(templatesDir)) {
      console.log("✔ validate-templates-missing passed (no templates directory)");
      return;
    }

    // ------------------------------------------------------------
    // Load system.json template references
    // ------------------------------------------------------------
    const systemPath = path.join(root, "system.json");
    let systemTemplates = [];

    if (fs.existsSync(systemPath)) {
      try {
        const raw = fs.readFileSync(systemPath, "utf8");
        const system = JSON.parse(raw);

        if (Array.isArray(system.templates)) {
          systemTemplates = system.templates;
        }
      } catch (err) {
        issues.push({
          file: systemPath,
          message: `Invalid JSON (${err.message})`
        });
      }
    }

    // ------------------------------------------------------------
    // Collect all template files on disk
    // ------------------------------------------------------------
    const diskTemplates = fs
      .readdirSync(templatesDir)
      .filter(f => f.endsWith(".html"))
      .map(f => path.join("templates", f));

    const diskSet = new Set(diskTemplates);

    // ------------------------------------------------------------
    // Validate system.json template references
    // ------------------------------------------------------------
    for (let i = 0; i < systemTemplates.length; i++) {
      const entry = systemTemplates[i];

      if (typeof entry !== "string") {
        issues.push({
          file: systemPath,
          message: `templates[${i}] must be a string`
        });
        continue;
      }

      const full = path.join(root, entry);
      if (!fs.existsSync(full)) {
        issues.push({
          file: systemPath,
          message: `Missing template file: ${entry}`
        });
      }
    }

    // ------------------------------------------------------------
    // Scan templates for {{> partial}} includes
    // ------------------------------------------------------------
    const partialGraph = new Map(); // template → [partials]

    for (const file of diskTemplates) {
      const full = path.join(root, file);
      const raw = fs.readFileSync(full, "utf8");

      const partials = [];
      let i = 0;

      while (i < raw.length) {
        const start = raw.indexOf("{{>", i);
        if (start === -1) break;

        const end = raw.indexOf("}}", start + 3);
        if (end === -1) break;

        const expr = raw.slice(start + 3, end).trim();
        i = end + 2;

        if (expr.length === 0) {
          issues.push({
            file: full,
            message: "Empty partial include '{{> }}'"
          });
          continue;
        }

        // Convert partial name to expected file path
        const partialPath = path.join("templates", `${expr}.html`);
        partials.push(partialPath);

        // Check existence
        if (!diskSet.has(partialPath)) {
          issues.push({
            file: full,
            message: `Missing partial template: ${partialPath}`
          });
        }
      }

      partialGraph.set(file, partials);
    }

    // ------------------------------------------------------------
    // Detect circular partial includes
    // ------------------------------------------------------------
    function detectCycle(start, visited, stack) {
      if (stack.has(start)) return true;
      if (visited.has(start)) return false;

      visited.add(start);
      stack.add(start);

      const children = partialGraph.get(start) || [];
      for (const child of children) {
        if (detectCycle(child, visited, stack)) return true;
      }

      stack.delete(start);
      return false;
    }

    for (const file of partialGraph.keys()) {
      const visited = new Set();
      const stack = new Set();

      if (detectCycle(file, visited, stack)) {
        issues.push({
          file,
          message: "Circular partial include detected"
        });
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (issues.length > 0) {
      console.log("❌ validate-templates-missing found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("Template missing validation failed");
    } else {
      console.log("✔ validate-templates-missing passed");
    }
  } catch (err) {
    console.log("⚠ validate-templates-missing encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
