// EQ5e Tool — Auto‑Generated Header

// tools/enforce-tool-headers.js
// Ensures every tool script has the required header and footer blocks.

export default async function enforceToolHeaders({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

    const REQUIRED_HEADER = `// EQ5e Tool — Auto‑Generated Header`;
    const REQUIRED_FOOTER = `// End of EQ5e Tool`;

    const files = fs
      .readdirSync(__dirname)
      .filter(f => f.endsWith(".js"))
      .filter(
        f =>
          f !== "cli.mjs" &&
          f !== "parallel.js" &&
          f !== "dependency-graph.js"
      );

    const fixed = [];
    const missing = [];

    for (const file of files) {
      const full = path.join(__dirname, file);
      let src = fs.readFileSync(full, "utf8");

      const hasHeader = src.trimStart().startsWith(REQUIRED_HEADER);
      const hasFooter = src.trimEnd().endsWith(REQUIRED_FOOTER);

      if (hasHeader && hasFooter) continue;

      missing.push(file);

      let newSrc = src;

      if (!hasHeader) {
        newSrc = `${REQUIRED_HEADER}\n\n${newSrc}`;
      }

      if (!hasFooter) {
        newSrc = `${newSrc.trim()}\n\n${REQUIRED_FOOTER}\n`;
      }

      fs.writeFileSync(full, newSrc);
      fixed.push(file);
    }

    if (fixed.length > 0) {
      console.log("✔ enforce-tool-headers fixed:");
      for (const f of fixed) console.log(" - " + f);
    } else {
      console.log("✔ enforce-tool-headers passed");
    }

    if (missing.length > 0 && strict) {
      throw new Error("Missing tool headers/footers detected");
    }
  } catch (err) {
    console.log("⚠ enforce-tool-headers encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
