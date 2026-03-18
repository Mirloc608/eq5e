// EQ5e Tool — Auto‑Generated Header

// tools/generate-zip.js
// Builds a Foundry-ready release ZIP package for the EQ5e system.

export default async function generateZip({ strict = false } = {}) {
  const fs = await import("node:fs");
  const fsp = await import("node:fs/promises");
  const path = await import("node:path");
  const url = await import("node:url");

  // Import archiver in ESM-safe mode
  const { default: archiver } = await import("archiver");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const dist = path.join(root, "dist");
    const outFile = path.join(dist, "eq5e.zip");

    // Ensure dist/ exists
    if (!fs.existsSync(dist)) {
      await fsp.mkdir(dist, { recursive: true });
    }

    // Ensure system.json exists
    const systemJson = path.join(root, "system.json");
    if (!fs.existsSync(systemJson)) {
      console.log("❌ generate-zip failed: system.json not found");
      if (strict) throw new Error("Missing system.json");
      return;
    }

    // Create ZIP stream
    const output = fs.createWriteStream(outFile);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);

    // Files to exclude
    const EXCLUDE = new Set([
      ".DS_Store",
      "Thumbs.db",
      "desktop.ini",
      "npm-debug.log",
      "yarn-error.log"
    ]);

    // Recursively add files
    async function addFolder(folder, prefix = "") {
      const entries = await fsp.readdir(folder, { withFileTypes: true });

      for (const entry of entries) {
        if (EXCLUDE.has(entry.name)) continue;

        const full = path.join(folder, entry.name);
        const rel = path.join(prefix, entry.name);

        if (entry.isDirectory()) {
          await addFolder(full, rel);
        } else {
          archive.file(full, { name: rel });
        }
      }
    }

    // Add everything except dist/
    const rootEntries = await fsp.readdir(root, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (entry.name === "dist") continue;
      if (entry.name === "node_modules") continue;

      const full = path.join(root, entry.name);

      if (entry.isDirectory()) {
        await addFolder(full, entry.name);
      } else {
        archive.file(full, { name: entry.name });
      }
    }

    await archive.finalize();

    console.log(`✔ generate-zip created ${outFile}`);
  } catch (err) {
    console.log("⚠ generate-zip encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
