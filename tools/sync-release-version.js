// EQ5e Tool — Auto‑Generated Header

// tools/sync-release-version.js
// Synchronizes system.json version and URLs with the latest Git tag.

export default async function syncReleaseVersion({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");
  const { execSync } = await import("node:child_process");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const systemPath = path.join(root, "system.json");

    if (!fs.existsSync(systemPath)) {
      console.log("⚠ No system.json found, skipping sync-release-version");
      return;
    }

    // --- Get latest tag ---
    let tag = "";
    try {
      tag = execSync("git describe --tags --abbrev=0").toString().trim();
    } catch {
      console.log("⚠ No git tags found, cannot sync version");
      return;
    }

    const version = tag.replace(/^v/, ""); // strip leading v

    // --- Detect repo info ---
    let owner = "unknown";
    let repo = "unknown";

    try {
      const remote = execSync("git config --get remote.origin.url")
        .toString()
        .trim();

      const match =
        remote.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/) || [];

      owner = match[1] || owner;
      repo = match[2] || repo;
    } catch {
      // fallback already set
    }

    const RAW_BASE = `https://raw.githubusercontent.com/${owner}/${repo}/main`;
    const RELEASE_BASE = `https://github.com/${owner}/${repo}/releases/download/${tag}`;

    const system = JSON.parse(fs.readFileSync(systemPath, "utf8"));
    let modified = false;

    // --- Sync version ---
    if (system.version !== version) {
      console.log(`✔ Updated version: ${system.version} → ${version}`);
      system.version = version;
      modified = true;
    }

    // --- Sync manifest URL ---
    const expectedManifest = `${RAW_BASE}/system.json`;
    if (system.manifest !== expectedManifest) {
      console.log("✔ Updated manifest URL");
      system.manifest = expectedManifest;
      modified = true;
    }

    // --- Sync download URL ---
    const expectedDownload = `${RELEASE_BASE}/${repo}.zip`;
    if (system.download !== expectedDownload) {
      console.log("✔ Updated download URL");
      system.download = expectedDownload;
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(systemPath, JSON.stringify(system, null, 2));
      console.log("✔ sync-release-version updated system.json");
    } else {
      console.log("✔ sync-release-version passed");
    }
  } catch (err) {
    console.log("⚠ sync-release-version encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
