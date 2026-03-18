// EQ5e Tool — Auto‑Generated Header

// tools/validate-readme.js
// Ensures that README.md exists, is non-empty, and contains required sections.

export default async function validateReadme({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const issues = [];

    const readmePath = path.join(root, "README.md");

    // ------------------------------------------------------------
    // Check existence
    // ------------------------------------------------------------
    if (!fs.existsSync(readmePath)) {
      issues.push({
        file: readmePath,
        message: "Missing README.md"
      });
      report();
      return;
    }

    // ------------------------------------------------------------
    // Load README.md
    // ------------------------------------------------------------
    let content = "";
    try {
      content = fs.readFileSync(readmePath, "utf8");
    } catch (err) {
      issues.push({
        file: readmePath,
        message: `Unable to read README.md (${err.message})`
      });
      report();
      return;
    }

    if (content.trim().length === 0) {
      issues.push({
        file: readmePath,
        message: "README.md is empty"
      });
    }

    // ------------------------------------------------------------
    // Required sections
    // ------------------------------------------------------------
    const REQUIRED_SECTIONS = [
      "# Installation",
      "# Usage",
      "# Licensing",
      "# Credits"
    ];

    for (const section of REQUIRED_SECTIONS) {
      if (!content.includes(section)) {
        issues.push({
          file: readmePath,
          message: `Missing required section: ${section}`
        });
      }
    }

    // ------------------------------------------------------------
    // Disallowed placeholder text
    // ------------------------------------------------------------
    const BAD_MARKERS = ["TODO", "FIXME", "INSERT HERE", "TBD"];

    for (const marker of BAD_MARKERS) {
      if (content.includes(marker)) {
        issues.push({
          file: readmePath,
          message: `README.md contains placeholder text: '${marker}'`
        });
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    function report() {
      if (issues.length > 0) {
        console.log("❌ validate-readme found issues:\n");
        for (const issue of issues) {
          console.log(` - ${issue.file} → ${issue.message}`);
        }
        if (strict) throw new Error("README validation failed");
      } else {
        console.log("✔ validate-readme passed");
      }
    }

    report();
  } catch (err) {
    console.log("⚠ validate-readme encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
