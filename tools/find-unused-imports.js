// EQ5e Tool — Auto‑Generated Header

// tools/find-unused-imports.js
// Parser-aware detector for unused ES module imports.

export default async function findUnusedImports({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const JS_EXT = ".js";
    const issues = [];

    function walk(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.endsWith(JS_EXT)) scanFile(full);
      }
    }

    // ------------------------------------------------------------
    // State-machine-based noise stripper (never hangs)
    // ------------------------------------------------------------
    function stripNoise(line) {
      let out = "";
      let i = 0;
      let state = "code"; // code | string | template | regex | block
      let stringChar = null;

      while (i < line.length) {
        const c = line[i];
        const next = line[i + 1];

        // Block comment end
        if (state === "block") {
          if (c === "*" && next === "/") {
            state = "code";
            i += 2;
            continue;
          }
          i++;
          continue;
        }

        // Block comment start
        if (state === "code" && c === "/" && next === "*") {
          state = "block";
          i += 2;
          continue;
        }

        // Line comment
        if (state === "code" && c === "/" && next === "/") break;

        // String start
        if (state === "code" && (c === '"' || c === "'")) {
          state = "string";
          stringChar = c;
          i++;
          continue;
        }

        // Template literal start
        if (state === "code" && c === "`") {
          state = "template";
          i++;
          continue;
        }

        // Regex literal start
        if (state === "code" && c === "/" && next !== "/" && next !== "*") {
          state = "regex";
          i++;
          continue;
        }

        // End string
        if (state === "string" && c === stringChar && line[i - 1] !== "\\") {
          state = "code";
          i++;
          continue;
        }

        // End template
        if (state === "template" && c === "`" && line[i - 1] !== "\\") {
          state = "code";
          i++;
          continue;
        }

        // End regex
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

    // ------------------------------------------------------------
    // Scan a file for unused imports
    // ------------------------------------------------------------
    function scanFile(filePath) {
      const raw = fs.readFileSync(filePath, "utf8");
      const lines = raw.split("\n");

      const imports = new Map(); // localName -> { line, kind }
      const used = new Set();

      // First pass: collect imports
      for (let i = 0; i < lines.length; i++) {
        const line = stripNoise(lines[i]);
        if (!line) continue;

        // import defaultExport from "module";
        let m = line.match(/^import\s+([A-Za-z_$][\w$]*)\s+from\s+["'][^"']+["'];?$/);
        if (m) {
          imports.set(m[1], { line: i + 1, kind: "default" });
          continue;
        }

        // import * as ns from "module";
        m = line.match(/^import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+["'][^"']+["'];?$/);
        if (m) {
          imports.set(m[1], { line: i + 1, kind: "namespace" });
          continue;
        }

        // import { a, b as c } from "module";
        m = line.match(/^import\s*{\s*([^}]+)\s*}\s*from\s+["'][^"']+["'];?$/);
        if (m) {
          const spec = m[1].split(",").map(s => s.trim()).filter(Boolean);
          for (const part of spec) {
            const aliasMatch = part.match(/^([A-Za-z_$][\w$]*)(\s+as\s+([A-Za-z_$][\w$]*))?$/);
            if (!aliasMatch) continue;
            const local = aliasMatch[3] || aliasMatch[1];
            imports.set(local, { line: i + 1, kind: "named" });
          }
        }
      }

      if (imports.size === 0) return;

      // Second pass: detect usage
      for (let i = 0; i < lines.length; i++) {
        const line = stripNoise(lines[i]);
        if (!line) continue;

        for (const local of imports.keys()) {
          const re = new RegExp(`\\b${local}\\b`);
          if (re.test(line)) {
            used.add(local);
          }
        }
      }

      // Report unused
      for (const [local, meta] of imports.entries()) {
        if (!used.has(local)) {
          issues.push({
            file: filePath,
            line: meta.line,
            message: `Unused import '${local}' (${meta.kind})`
          });
        }
      }
    }

    walk(root);

    if (issues.length > 0) {
      console.log("❌ find-unused-imports found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file}:${issue.line} → ${issue.message}`);
      }
      if (strict) throw new Error("Unused imports detected");
    } else {
      console.log("✔ find-unused-imports passed");
    }
  } catch (err) {
    console.log("⚠ find-unused-imports encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
