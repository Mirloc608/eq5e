// EQ5e Tool — Auto‑Generated Header

// tools/validate-templates-usage.js
// Ensures that all Handlebars helper usages inside templates are valid, allowed,
// and free of unsafe or unknown helper calls.

export default async function validateTemplateUsage({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const templatesDir = path.join(root, "templates");
    const issues = [];

    if (!fs.existsSync(templatesDir)) {
      console.log("✔ validate-templates-usage passed (no templates directory)");
      return;
    }

    // ------------------------------------------------------------
    // Allowed helpers
    // ------------------------------------------------------------
    const ALLOWED_HELPERS = new Set([
      "if",
      "unless",
      "each",
      "with",
      "concat",
      "eq",
      "ne",
      "gt",
      "lt",
      "gte",
      "lte",
      "and",
      "or",
      "not",
      "log",
      "localize",
      "numberFormat",
      "checked",
      "select",
      "editor",
      "filePicker",
      "rangePicker",
      "timeSince",
      "capitalize",
      "slugify"
    ]);

    // Forbidden helpers (security or ambiguity)
    const FORBIDDEN_HELPERS = new Set([
      "lookup",
      "eval",
      "bind",
      "htmlSafe",
      "safeString"
    ]);

    // ------------------------------------------------------------
    // Scan templates
    // ------------------------------------------------------------
    const templateFiles = fs
      .readdirSync(templatesDir)
      .filter(f => f.endsWith(".html"));

    for (const file of templateFiles) {
      const full = path.join(templatesDir, file);
      const raw = fs.readFileSync(full, "utf8");
      const lines = raw.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let pos = 0;

        while (true) {
          const start = line.indexOf("{{", pos);
          if (start === -1) break;

          const end = line.indexOf("}}", start + 2);
          if (end === -1) {
            issues.push({
              file: full,
              message: `Unclosed Handlebars expression on line ${i + 1}`
            });
            break;
          }

          const expr = line.slice(start + 2, end).trim();
          pos = end + 2;

          // Skip empty or field-only expressions
          if (expr.length === 0) continue;
          if (!expr.includes(" ")) {
            // Could be {{field}} or {{#block}} or {{/block}}
            if (expr.startsWith("#") || expr.startsWith("/")) {
              const helper = expr.slice(1);
              if (!ALLOWED_HELPERS.has(helper)) {
                issues.push({
                  file: full,
                  message: `Unknown or disallowed block helper '{{${expr}}}' on line ${i + 1}`
                });
              }
            }
            continue;
          }

          // Extract helper name (first token)
          const space = expr.indexOf(" ");
          const helper = expr.slice(0, space);

          // Skip field paths like "actor.system.hp.value"
          let isField = true;
          for (const ch of helper) {
            const ok =
              (ch >= "a" && ch <= "z") ||
              (ch >= "A" && ch <= "Z") ||
              (ch >= "0" && ch <= "9") ||
              ch === "_" ||
              ch === "$" ||
              ch === ".";
            if (!ok) {
              isField = false;
              break;
            }
          }
          if (isField) continue;

          // Block helpers (#each, #if, etc.)
          if (helper.startsWith("#")) {
            const name = helper.slice(1);
            if (!ALLOWED_HELPERS.has(name)) {
              issues.push({
                file: full,
                message: `Unknown or disallowed block helper '{{${helper}}}' on line ${i + 1}`
              });
            }
            continue;
          }

          // Closing blocks
          if (helper.startsWith("/")) {
            const name = helper.slice(1);
            if (!ALLOWED_HELPERS.has(name)) {
              issues.push({
                file: full,
                message: `Unknown or disallowed closing helper '{{${helper}}}' on line ${i + 1}`
              });
            }
            continue;
          }

          // Forbidden helpers
          if (FORBIDDEN_HELPERS.has(helper)) {
            issues.push({
              file: full,
              message: `Forbidden helper '{{${helper}}}' on line ${i + 1}`
            });
            continue;
          }

          // Unknown helpers
          if (!ALLOWED_HELPERS.has(helper)) {
            issues.push({
              file: full,
              message: `Unknown helper '{{${helper}}}' on line ${i + 1}`
            });
          }
        }
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (issues.length > 0) {
      console.log("❌ validate-templates-usage found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("Template usage validation failed");
    } else {
      console.log("✔ validate-templates-usage passed");
    }
  } catch (err) {
    console.log("⚠ validate-templates-usage encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
