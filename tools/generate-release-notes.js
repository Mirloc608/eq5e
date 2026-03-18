// EQ5e Tool — Auto‑Generated Header

// tools/generate-release-notes.js
// Generates release-notes.md from git commit history using conventional commits.

export default async function generateReleaseNotes({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");
  const { execSync } = await import("node:child_process");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const notesPath = path.join(root, "release-notes.md");

    // --- Get tags ---
    const tags = execSync("git tag --sort=-creatordate")
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean);

    if (tags.length < 1) {
      console.log("⚠ No tags found, cannot generate release notes");
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
      console.log("✔ No new commits to include in release notes");
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

    // --- Build release notes ---
    let notes = `# Release ${latest}\n\n`;

    function addGroup(title, items) {
      if (items.length === 0) return;
      notes += `## ${title}\n`;
      for (const item of items) notes += `- ${item}\n`;
      notes += `\n`;
    }

    addGroup("✨ Features", groups.feat);
    addGroup("🐛 Fixes", groups.fix);
    addGroup("📝 Documentation", groups.docs);
    addGroup("🔧 Refactoring", groups.refactor);
    addGroup("📦 Chores", groups.chore);
    addGroup("🧪 Tests", groups.test);
    addGroup("📚 Other", groups.other);

    // --- Write release-notes.md ---
    fs.writeFileSync(notesPath, notes);

    console.log(`✔ generate-release-notes created release-notes.md for ${latest}`);
  } catch (err) {
    console.log("⚠ generate-release-notes encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
