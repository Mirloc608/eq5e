// EQ5e Tool — Auto‑Generated Header

// tools/convert-to-esm.js
// Converts CommonJS modules to ES module syntax where possible.

export default async function convertToEsm({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const JS_EXT = ".js";

    function walk(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.endsWith(JS_EXT)) convertFile(full);
      }
    }

    function convertFile(filePath) {
      let src = fs.readFileSync(filePath, "utf8");

      // Skip if already ESM
      if (src.includes("import ") || src.includes("export ")) return;

      let changed = false;

      // Convert require() → import
      src = src.replace(
        /const\s+(\w+)\s*=\s*require\(["'`](.+?)["'`]\);?/g,
        (m, name, target) => {
          changed = true;
          return `import ${name} from "${target}";`;
        }
      );

      // Convert destructured require
      src = src.replace(
        /const\s+{([^}]+)}\s*=\s*require\(["'`](.+?)["'`]\);?/g,
        (m, names, target) => {
          changed = true;
          return `import { ${names.trim()} } from "${target}";`;
        }
      );

      // Convert module.exports = ...
      src = src.replace(
        /module\.exports\s*=\s*(\w+);?/g,
        (m, name) => {
          changed = true;
          return `export default ${name};`;
        }
      );

      // Convert exports.foo = ...
      src = src.replace(
        /exports\.(\w+)\s*=\s*(\w+);?/g,
        (m, key, val) => {
          changed = true;
          return `export const ${key} = ${val};`;
        }
      );

      if (changed) {
        fs.writeFileSync(filePath, src);
        console.log(`✔ Converted to ESM: ${path.relative(root, filePath)}`);
      }
    }

    walk(root);
  } catch (err) {
    console.log("⚠ convert-to-esm encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
