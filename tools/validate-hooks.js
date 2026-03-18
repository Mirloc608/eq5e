// EQ5e Tool — Auto‑Generated Header

// tools/validate-hooks.js
// Ensures that all Foundry hook registrations are valid and structurally correct.

export default async function validateHooks({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const issues = [];

    // ------------------------------------------------------------
    // Allowed Foundry hook names (static allow-list)
    // ------------------------------------------------------------
    const ALLOWED_HOOKS = [
      "init",
      "setup",
      "ready",
      "canvasReady",
      "updateActor",
      "updateItem",
      "createActor",
      "createItem",
      "deleteActor",
      "deleteItem",
      "preUpdateActor",
      "preUpdateItem",
      "preCreateActor",
      "preCreateItem",
      "preDeleteActor",
      "preDeleteItem",
      "renderActorSheet",
      "renderItemSheet",
      "renderChatMessage",
      "getActorSheetHeaderButtons",
      "getItemSheetHeaderButtons"
    ];

    // ------------------------------------------------------------
    // Scan system code for Hooks.on / Hooks.once
    // ------------------------------------------------------------
    const SCAN_DIRS = ["module", "scripts", "src"];

    function walk(dir) {
      const base = path.basename(dir);

      if (
        base === "node_modules" ||
        base === "dist" ||
        base === "packs" ||
        base === "tests"
      ) {
        return;
      }

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && entry.name.endsWith(".js")) {
          scanFile(full);
        }
      }
    }

    function scanFile(filePath) {
      const raw = fs.readFileSync(filePath, "utf8");
      const lines = raw.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Detect Hooks.on("X", ...) or Hooks.once("X", ...)
        const isOn = line.includes("Hooks.on(");
        const isOnce = line.includes("Hooks.once(");
        if (!isOn && !isOnce) continue;

        const idx = line.indexOf("(");
        if (idx === -1) continue;

        // Extract hook name
        const quote = line.includes('"') ? '"' : line.includes("'") ? "'" : null;
        if (!quote) {
          issues.push({
            file: `${filePath}:${i + 1}`,
            message: "Hook name must be a quoted string"
          });
          continue;
        }

        const start = line.indexOf(quote, idx);
        const end = line.indexOf(quote, start + 1);
        if (start === -1 || end === -1) {
          issues.push({
            file: `${filePath}:${i + 1}`,
            message: "Malformed hook name"
          });
          continue;
        }

        const hookName = line.slice(start + 1, end);

        // Validate hook name
        if (!ALLOWED_HOOKS.includes(hookName)) {
          issues.push({
            file: `${filePath}:${i + 1}`,
            message: `Unknown or unsupported hook '${hookName}'`
          });
        }

        // Validate callback
        const after = line.slice(end + 1).trim();
        const hasArrow = after.includes("=>");
        const hasFunction = after.includes("function");

        if (!hasArrow && !hasFunction) {
          issues.push({
            file: `${filePath}:${i + 1}`,
            message: "Hook callback must be a function or arrow function"
          });
        }
      }
    }

    for (const dir of SCAN_DIRS) {
      const full = path.join(root, dir);
      if (fs.existsSync(full)) walk(full);
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (issues.length > 0) {
      console.log("❌ validate-hooks found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("Hook validation failed");
    } else {
      console.log("✔ validate-hooks passed");
    }
  } catch (err) {
    console.log("⚠ validate-hooks encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
