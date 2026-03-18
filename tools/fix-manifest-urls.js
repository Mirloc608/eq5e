// EQ5e Tool — Auto‑Generated Header

// tools/fix-manifest-urls.js
// Auto‑corrects manifest, download, and documentation URLs in system.json.

export default async function fixManifestUrls({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");
  const { execSync } = await import("node:child_process");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const systemPath = path.join(root, "system.json");

    if (!fs.existsSync(systemPath)) {
      console.log("⚠ No system.json found, skipping fix-manifest-urls");
      return;
    }

    const system = JSON.parse(fs.readFileSync(systemPath, "utf8"));

    // Detect repo info from git
    let repo = null;
    let owner = null;

    try {
      const remote = execSync("git config --get remote.origin.url")
        .toString()
        .trim();

      // Supports both SSH and HTTPS
      const match =
        remote.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/) || [];

      owner = match[1] || "unknown";
      repo = match[2] || "unknown";
    } catch {
      owner = "unknown";
      repo = "unknown";
    }

    const RAW_BASE = `https://raw.githubusercontent.com/${owner}/${repo}/main`;
    const RELEASE_BASE = `https://github.com/${owner}/${repo}/releases/latest/download`;

    let modified = false;

    // --- Fix manifest URL ---
    const expectedManifest = `${RAW_BASE}/system.json`;
    if (system.manifest !== expectedManifest) {
      console.log(`✔ Fixed manifest URL`);
      system.manifest = expectedManifest;
      modified = true;
    }

    // --- Fix download URL ---
    const expectedDownload = `${RELEASE_BASE}/${repo}.zip`;
    if (system.download !== expectedDownload) {
      console.log(`✔ Fixed download URL`);
      system.download = expectedDownload;
      modified = true;
    }

    // --- Fix readme URL (optional) ---
    if (system.readme) {
      const expectedReadme = `${RAW_BASE}/README.md`;
      if (system.readme !== expectedReadme) {
        console.log(`✔ Fixed readme URL`);
        system.readme = expectedReadme;
        modified = true;
      }
    }

    // --- Fix changelog URL (optional) ---
    if (system.changelog) {
      const expectedChangelog = `${RAW_BASE}/CHANGELOG.md`;
      if (system.changelog !== expectedChangelog) {
        console.log(`✔ Fixed changelog URL`);
        system.changelog = expectedChangelog;
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(systemPath, JSON.stringify(system, null, 2));
      console.log("✔ fix-manifest-urls updated system.json");
    } else {
      console.log("✔ fix-manifest-urls passed");
    }
  } catch (err) {
    console.log("⚠ fix-manifest-urls encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
