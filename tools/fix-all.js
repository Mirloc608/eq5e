// EQ5e Tool — Auto‑Generated Header

// tools/fix-all.js
// Runs all fix-* tools in the tools directory in a deterministic, ESM-safe way.

export default async function fixAll({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  const { pathToFileURL } = url;

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const toolsDir = path.resolve(__dirname);

    // Discover all fix-* tools (excluding fix-all itself)
    const entries = fs.readdirSync(toolsDir, { withFileTypes: true });

    const fixers = entries
      .filter(e => e.isFile() && e.name.startsWith("fix-") && e.name.endsWith(".js"))
      .map(e => e.name)
      .filter(name => name !== "fix-all.js")
      .sort(); // deterministic order

    if (fixers.length === 0) {
      console.log("⚠ No fix-* tools found, skipping fix-all");
      return;
    }

    console.log(`Running ${fixers.length} fixers...`);
    const errors = [];

    for (const file of fixers) {
      const fullPath = path.join(toolsDir, file);
      const fileUrl = pathToFileURL(fullPath).href;

      try {
        const mod = await import(fileUrl);
        const fn = mod.default;

        if (typeof fn !== "function") {
          errors.push({
            tool: file,
            message: "Default export is not a function"
          });
          continue;
        }

        await fn({ strict });
      } catch (err) {
        errors.push({
          tool: file,
          message: err?.message || String(err)
        });
        if (strict) break;
      }
    }

    if (errors.length > 0) {
      console.log("❌ fix-all encountered errors:\n");
      for (const err of errors) {
        console.log(` - ${err.tool}: ${err.message}`);
      }
      if (strict) throw new Error("fix-all failed");
    } else {
      console.log("✔ fix-all passed");
    }
  } catch (err) {
    console.log("⚠ fix-all encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
