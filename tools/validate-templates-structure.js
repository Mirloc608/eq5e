// EQ5e Tool — Auto‑Generated Header

// tools/validate-templates-structure.js
// Ensures that all Handlebars templates have valid structural HTML and well-formed
// Handlebars blocks, and checks for missing or duplicate attributes.

export default async function validateTemplateStructure({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const templatesDir = path.join(root, "templates");
    const issues = [];

    if (!fs.existsSync(templatesDir)) {
      console.log("✔ validate-templates-structure passed (no templates directory)");
      return;
    }

    const templateFiles = fs
      .readdirSync(templatesDir)
      .filter(f => f.endsWith(".html"));

    // ------------------------------------------------------------
    // Helper: safe attribute extraction (no regex)
    // ------------------------------------------------------------
    function extractAttribute(line, attr) {
      const key = `${attr}=`;
      const idx = line.indexOf(key);
      if (idx === -1) return null;

      const quote = line[idx + key.length];
      if (quote !== '"' && quote !== "'") return null;

      const start = idx + key.length + 1;
      const end = line.indexOf(quote, start);
      if (end === -1) return null;

      return line.slice(start, end);
    }

    // ------------------------------------------------------------
    // Helper: detect malformed Handlebars blocks
    // ------------------------------------------------------------
    function validateBlocks(lines, file) {
      const stack = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        let pos = 0;
        while (true) {
          const start = line.indexOf("{{", pos);
          if (start === -1) break;

          const end = line.indexOf("}}", start + 2);
          if (end === -1) {
            issues.push({
              file,
              message: `Unclosed Handlebars expression on line ${i + 1}`
            });
            break;
          }

          const expr = line.slice(start + 2, end).trim();
          pos = end + 2;

          if (expr.startsWith("#")) {
            stack.push({ block: expr.slice(1), line: i + 1 });
          } else if (expr.startsWith("/")) {
            const closing = expr.slice(1);
            const last = stack.pop();

            if (!last) {
              issues.push({
                file,
                message: `Unexpected closing block '{{/${closing}}}' on line ${i + 1}`
              });
            } else if (last.block !== closing) {
              issues.push({
                file,
                message: `Mismatched Handlebars block '{{#${last.block}}}' opened on line ${last.line} but closed with '{{/${closing}}}' on line ${i + 1}`
              });
            }
          }
        }
      }

      if (stack.length > 0) {
        for (const unclosed of stack) {
          issues.push({
            file,
            message: `Unclosed Handlebars block '{{#${unclosed.block}}}' opened on line ${unclosed.line}`
          });
        }
      }
    }

    // ------------------------------------------------------------
    // Main template validation
    // ------------------------------------------------------------
    for (const file of templateFiles) {
      const full = path.join(templatesDir, file);
      const raw = fs.readFileSync(full, "utf8");
      const lines = raw.split("\n");

      const seenIds = new Set();

      validateBlocks(lines, full);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Detect duplicate id=""
        const id = extractAttribute(line, "id");
        if (id) {
          if (seenIds.has(id)) {
            issues.push({
              file: full,
              message: `Duplicate id='${id}' on line ${i + 1}`
            });
          } else {
            seenIds.add(id);
          }
        }

        // Detect input/select/textarea missing name=""
        if (
          line.startsWith("<input") ||
          line.startsWith("<select") ||
          line.startsWith("<textarea")
        ) {
          const name = extractAttribute(line, "name");
          if (!name) {
            issues.push({
              file: full,
              message: `Form field missing name="" on line ${i + 1}`
            });
          }
        }

        // Detect label missing for=""
        if (line.startsWith("<label")) {
          const forAttr = extractAttribute(line, "for");
          if (!forAttr) {
            issues.push({
              file: full,
              message: `Label missing for="" on line ${i + 1}`
            });
          }
        }

        // Detect unclosed tags (simple heuristic)
        if (line.startsWith("<") && !line.endsWith(">")) {
          issues.push({
            file: full,
            message: `Possibly unclosed tag on line ${i + 1}`
          });
        }
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (issues.length > 0) {
      console.log("❌ validate-templates-structure found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("Template structure validation failed");
    } else {
      console.log("✔ validate-templates-structure passed");
    }
  } catch (err) {
    console.log("⚠ validate-templates-structure encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
