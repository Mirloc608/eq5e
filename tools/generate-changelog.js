// EQ5e Tool — Auto‑Generated Header

// tools/generate-changelog.js
// Generates CHANGELOG.md from git commit history using conventional commits.

export default async function generateChangelog({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");
  const { execSync } = await import("node:child_process");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const changelogPath = path.join(root, "CHANGELOG.md");

    // --- Get tags ---
    const tags = execSync("git tag --sort=-creatordate")
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean);

    if (tags.length < 1) {
      console.log("⚠ No tags found, cannot generate changelog");
      return;
    }

    const latest = tags[0];
    const previous = tags[1] || null;

    // --- Get commits between tags ---
    const range = previous ? `${previous}..${latest}` : latest;

    const rawCommits = execSync(`git log ${range} --pretty=format:%s`)
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean);

    if (rawCommits.length === 0) {
      console.log("✔ No new commits to include in changelog");
      return;
    }

    // --- Group commits by type ---
    const groups = {
      feat: [],
      fix: [],
      docs: [],
      refactor: [],
      chore: [],
      test: [],
      other: []
    };

    for (const msg of rawCommits) {
      const match = msg.match(/^(\w+)(\(.+\))?:\s*(.+)$/);

      if (match) {
        const type = match[1];
        const desc = match[3];

        if (groups[type]) groups[type].push(desc);
        else groups.other.push(msg);
      } else {
        groups.other.push(msg);
      }
    }

    // --- Build changelog section ---
    const date = new Date().toISOString().split("T")[0];

    let section = `## ${latest} — ${date}\n\n`;

    function addGroup(title, items) {
      if (items.length === 0) return;
      section += `### ${title}\n`;
      for (const item of items) section += `- ${item}\n`;
      section += `\n`;
    }

    addGroup("Features", groups.feat);
    addGroup("Fixes", groups.fix);
    addGroup("Documentation", groups.docs);
    addGroup("Refactoring", groups.refactor);
    addGroup("Chores", groups.chore);
    addGroup("Tests", groups.test);
    addGroup("Other", groups.other);

    // --- Insert into CHANGELOG.md ---
    let existing = "";
    if (fs.existsSync(changelogPath)) {
      existing = fs.readFileSync(changelogPath, "utf8");
    }

    const newContent = `${section}${existing.trim()}\n`;

    fs.writeFileSync(changelogPath, newContent);

    console.log(`✔ generate-changelog added section for ${latest}`);
  } catch (err) {
    console.log("⚠ generate-changelog encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
