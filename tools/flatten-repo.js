// EQ5e Tool — Auto‑Generated Header

// tools/flatten-repo.js
// Flattens nested repo structures (e.g., eq5e/eq5e → eq5e).

export default async function flattenRepo({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    // Detect nested folder containing system.json
    const candidates = fs
      .readdirSync(root, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => path.join(root, d.name));

    let nested = null;

    for (const dir of candidates) {
      const sys = path.join(dir, "system.json");
      if (fs.existsSync(sys)) {
        nested = dir;
        break;
      }
    }

    if (!nested) {
      console.log("✔ Repo already flattened");
      return;
    }

    console.log(`🔄 Flattening repo: moving contents of ${path.basename(nested)}/ → root`);

    const items = fs.readdirSync(nested);

    for (const item of items) {
      const src = path.join(nested, item);
      const dest = path.join(root, item);

      if (fs.existsSync(dest)) {
        console.log(`⚠ Skipping existing: ${item}`);
        continue;
      }

      fs.renameSync(src, dest);
      console.log(`✔ Moved: ${item}`);
    }

    fs.rmdirSync(nested);
    console.log(`✔ Removed nested folder: ${path.basename(nested)}`);
    console.log("✔ Repo flattened");
  } catch (err) {
    console.log("⚠ flatten-repo encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
