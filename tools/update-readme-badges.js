// EQ5e Tool — Auto‑Generated Header

// tools/update-readme-badges.js
// Updates the badges section in README.md safely (no multi-line regex literals).

export default async function updateReadmeBadges({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const readmePath = path.join(root, "README.md");

    if (!fs.existsSync(readmePath)) {
      console.log("⚠ README.md not found, skipping update-readme-badges");
      return;
    }

    const readme = fs.readFileSync(readmePath, "utf8");
    const lines = readme.split("\n");

    const startMarker = "<!-- BADGES:START -->";
    const endMarker = "<!-- BADGES:END -->";

    const startIndex = lines.findIndex(l => l.includes(startMarker));
    const endIndex = lines.findIndex(l => l.includes(endMarker));

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      console.log("⚠ Badge markers not found or malformed, skipping update-readme-badges");
      return;
    }

    // Build new badges block
    const newBadges = [
      startMarker,
      "",
      `[![Version](https://img.shields.io/badge/version-auto-blue.svg)](https://github.com/Mirloc608/eq5e)`,
      `[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)`,
      `[![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)`,
      "",
      endMarker
    ];

    const updated = [
      ...lines.slice(0, startIndex),
      ...newBadges,
      ...lines.slice(endIndex + 1)
    ].join("\n");

    fs.writeFileSync(readmePath, updated, "utf8");

    console.log("✔ update-readme-badges updated README.md");
  } catch (err) {
    console.log("⚠ update-readme-badges encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
