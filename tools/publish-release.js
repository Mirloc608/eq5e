// EQ5e Tool — Auto‑Generated Header

export default async function publishRelease({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");
  const { execSync } = await import("node:child_process");

  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const root = path.resolve(__dirname, "..");

  const system = JSON.parse(fs.readFileSync(path.join(root, "system.json"), "utf8"));
  const version = system.version;
  const zipPath = path.join(root, "dist", "eq5e.zip");

  if (!fs.existsSync(zipPath)) {
    console.log("⚠ ZIP not found, skipping publish");
    return;
  }

  console.log(`Publishing release v${version}...`);

  // Check if GitHub CLI exists
  try {
    execSync("gh --version", { stdio: "ignore" });
  } catch {
    console.log("⚠ GitHub CLI not found, skipping publish");
    return;
  }

  // Try to publish
  try {
    execSync(
      `gh release create v${version} "${zipPath}" --title "v${version}" --notes-file RELEASE_NOTES.md`,
      { stdio: "inherit" }
    );
  } catch {
    console.log("⚠ Failed to publish release, skipping");
    return;
  }

  console.log("✔ Release published");
}

// End of EQ5e Tool
