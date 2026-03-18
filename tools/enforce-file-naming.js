// EQ5e Tool — Auto‑Generated Header

// tools/enforce-file-naming.js
// Ensures all tool files follow strict naming conventions.

export default async function enforceFileNaming({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

    const APPROVED_PREFIXES = [
      "bump-",
      "convert-",
      "detect-",
      "enforce-",
      "ensure-",
      "find-",
      "fix-",
      "flatten-",
      "generate-",
      "lint-",
      "sort-",
      "sync-",
      "update-",
      "validate-",
      "publish-",
      "release",
      "watch"
    ];

    const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".js"));

    const bad = [];

    for (const file of files) {
      if (file === "cli.mjs" || file === "parallel.js" || file === "dependency-graph.js") {
        continue;
      }

      const name = file.replace(".js", "");

      // Must be lowercase
      if (/[A-Z]/.test(name)) {
        bad.push({ file, reason: "Contains uppercase letters" });
        continue;
      }

      // Must not contain spaces
      if (/\s/.test(name)) {
        bad.push({ file, reason: "Contains spaces" });
        continue;
      }

      // Must start with an approved prefix
      const ok = APPROVED_PREFIXES.some(prefix => name.startsWith(prefix));
      if (!ok) {
        bad.push({ file, reason: "Unclassified tool name" });
        continue;
      }
    }

    if (bad.length > 0) {
      console.log("❌ File naming violations:\n");
      for (const b of bad) {
        console.log(` - ${b.file}: ${b.reason}`);
      }
      if (strict) throw new Error("File naming violations detected");
      return;
    }

    console.log("✔ enforce-file-naming passed");
  } catch (err) {
    console.log("⚠ enforce-file-naming encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
