// EQ5e Tool — Auto‑Generated Header

// tools/bump-version.js
// Auto‑bumps the system.json version based on commit messages or fallback rules.

export default async function bumpVersion({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");
  const { execSync } = await import("node:child_process");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const systemPath = path.join(root, "system.json");
    const system = JSON.parse(fs.readFileSync(systemPath, "utf8"));

    const oldVersion = system.version || "0.0.0";

    // Try to read the latest commit message (optional)
    let commitMsg = "";
    try {
      commitMsg = execSync("git log -1 --pretty=%B").toString().trim();
    } catch {
      // Git may not exist — that's fine
      commitMsg = "";
    }

    // Determine bump type
    let bump = "patch";
    if (/major/i.test(commitMsg)) bump = "major";
    else if (/minor/i.test(commitMsg)) bump = "minor";

    const [maj, min, pat] = oldVersion.split(".").map(n => parseInt(n, 10) || 0);

    let newVersion = oldVersion;
    if (bump === "major") newVersion = `${maj + 1}.0.0`;
    else if (bump === "minor") newVersion = `${maj}.${min + 1}.0`;
    else newVersion = `${maj}.${min}.${pat + 1}`;

    system.version = newVersion;

    fs.writeFileSync(systemPath, JSON.stringify(system, null, 2));

    console.log(`🔼 Version bumped: ${oldVersion} → ${newVersion}`);
  } catch (err) {
    console.log("⚠ bump-version encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
