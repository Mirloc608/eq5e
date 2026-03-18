// EQ5e Tool — Auto‑Generated Header

// tools/validate-github-actions.js
// Validates that GitHub Actions workflow YAML files exist, parse correctly,
// and contain required structural fields.

export default async function validateGithubActions({ strict = false } = {}) {
  const fs = await import("node:fs");
  const fsp = await import("node:fs/promises");
  const path = await import("node:path");
  const url = await import("node:url");

  // ESM-safe dynamic import of js-yaml
  const { load } = await import("js-yaml");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const workflowsDir = path.join(root, ".github", "workflows");
    const issues = [];

    // ------------------------------------------------------------
    // Ensure workflows directory exists
    // ------------------------------------------------------------
    if (!fs.existsSync(workflowsDir)) {
      issues.push({
        file: workflowsDir,
        message: "Missing .github/workflows directory"
      });
      return report();
    }

    const files = (await fsp.readdir(workflowsDir))
      .filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));

    if (files.length === 0) {
      issues.push({
        file: workflowsDir,
        message: "No workflow YAML files found"
      });
      return report();
    }

    // ------------------------------------------------------------
    // Validate each workflow file
    // ------------------------------------------------------------
    for (const file of files) {
      const full = path.join(workflowsDir, file);

      let parsed = null;
      try {
        const raw = await fsp.readFile(full, "utf8");
        parsed = load(raw);
      } catch (err) {
        issues.push({
          file: full,
          message: `Failed to parse YAML (${err.message})`
        });
        continue;
      }

      if (!parsed || typeof parsed !== "object") {
        issues.push({
          file: full,
          message: "Workflow is not a valid YAML object"
        });
        continue;
      }

      // Required fields
      if (!parsed.name) {
        issues.push({
          file: full,
          message: "Missing required 'name' field"
        });
      }

      if (!parsed.on) {
        issues.push({
          file: full,
          message: "Missing required 'on' trigger"
        });
      }

      if (!parsed.jobs || typeof parsed.jobs !== "object") {
        issues.push({
          file: full,
          message: "Missing required 'jobs' section"
        });
        continue;
      }

      // Validate jobs
      for (const [jobName, job] of Object.entries(parsed.jobs)) {
        if (!job || typeof job !== "object") {
          issues.push({
            file: full,
            message: `Job '${jobName}' is not a valid object`
          });
          continue;
        }

        if (!Array.isArray(job.steps)) {
          issues.push({
            file: full,
            message: `Job '${jobName}' missing required 'steps' array`
          });
          continue;
        }

        if (job.steps.length === 0) {
          issues.push({
            file: full,
            message: `Job '${jobName}' has no steps`
          });
        }

        // Validate steps
        for (let i = 0; i < job.steps.length; i++) {
          const step = job.steps[i];
          const prefix = `${full} (job '${jobName}', step ${i + 1})`;

          if (!step || typeof step !== "object") {
            issues.push({
              file: prefix,
              message: "Step is not a valid object"
            });
            continue;
          }

          if (!step.uses && !step.run) {
            issues.push({
              file: prefix,
              message: "Step must contain either 'uses' or 'run'"
            });
          }
        }
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    function report() {
      if (issues.length > 0) {
        console.log("❌ validate-github-actions found issues:\n");
        for (const issue of issues) {
          console.log(` - ${issue.file} → ${issue.message}`);
        }
        if (strict) throw new Error("GitHub Actions validation failed");
      } else {
        console.log("✔ validate-github-actions passed");
      }
    }

    report();
  } catch (err) {
    console.log("⚠ validate-github-actions encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
