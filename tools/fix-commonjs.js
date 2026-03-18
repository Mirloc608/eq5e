// EQ5e Tool — Auto‑Generated Header

// tools/fix-commonjs.js
// Converts CommonJS patterns to ESM where possible (strict, parser-aware).

export default async function fixCommonJS({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const JS_EXT = ".js";
    const fixes = [];

    function walk(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);

        // Skip node_modules
        if (entry.isDirectory() && entry.name === "node_modules") continue;

        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.endsWith(JS_EXT)) fixFile(full);
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
    // Fix a file
    // ------------------------------------------------------------
    function fixFile(filePath) {
      const raw = fs.readFileSync(filePath, "utf8");
      const lines = raw.split("\n");

      let changed = false;

      const newLines = lines.map((line) => {
        const clean = stripNoise(line);

        // module.exports = X → export default X
        if (/\bmodule\.exports\s*=/.test(clean)) {
          changed = true;
          return line.replace(/module\.exports\s*=/, "export default ");
        }

        // exports.foo = bar → export const foo = bar
        if (/\bexports\./.test(clean)) {
          changed = true;
          return line.replace(/exports\.(\w+)\s*=/, "export const $1 =");
        }

        // require("x") → import x from "x"
        if (/\bconst\s+(\w+)\s*=\s*require\(["']([^"']+)["']\)/.test(clean)) {
          changed = true;
          return line.replace(
            /\bconst\s+(\w+)\s*=\s*require\(["']([^"']+)["']\)/,
            'import $1 from "$2"'
          );
        }

        return line;
      });

      if (changed) {
        fs.writeFileSync(filePath, newLines.join("\n"), "utf8");
        fixes.push(filePath);
      }
    }

    walk(root);

    if (fixes.length > 0) {
      console.log("✔ fix-commonjs fixed:");
      for (const f of fixes) console.log(" - " + f);
    } else {
      console.log("✔ fix-commonjs passed");
    }
  } catch (err) {
    console.log("⚠ fix-commonjs encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
