// EQ5e Tool — Auto‑Generated Header

// tools/validate-compatibility.js
// Ensures that Foundry compatibility fields in system.json are valid and semver-correct.

export default async function validateCompatibility({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const issues = [];

    const systemPath = path.join(root, "system.json");
    if (!fs.existsSync(systemPath)) {
      console.log("✔ validate-compatibility passed (no system.json found)");
      return;
    }

    let system = null;

    // ------------------------------------------------------------
    // Load system.json
    // ------------------------------------------------------------
    try {
      const raw = fs.readFileSync(systemPath, "utf8");
      system = JSON.parse(raw);
    } catch (err) {
      issues.push({
        file: systemPath,
        message: `Invalid JSON (${err.message})`
      });
      report();
      return;
    }

    const compat = system.compatibility;
    if (!compat || typeof compat !== "object") {
      issues.push({
        file: systemPath,
        message: "Missing required compatibility block"
      });
      report();
      return;
    }

    // ------------------------------------------------------------
    // Validate semver
    // ------------------------------------------------------------
    function isSemver(v) {
      if (typeof v !== "string") return false;
      const parts = v.split(".");
      if (parts.length !== 3) return false;
      return parts.every(p => !isNaN(Number(p)));
    }

    function semverToTuple(v) {
      return v.split(".").map(n => Number(n));
    }

    function compareSemver(a, b) {
      const A = semverToTuple(a);
      const B = semverToTuple(b);
      for (let i = 0; i < 3; i++) {
        if (A[i] < B[i]) return -1;
        if (A[i] > B[i]) return 1;
      }
      return 0;
    }

    // ------------------------------------------------------------
    // Validate minimum
    // ------------------------------------------------------------
    if (!compat.minimum || typeof compat.minimum !== "string") {
      issues.push({
        file: systemPath,
        message: "compatibility.minimum must be a string"
      });
    } else if (!isSemver(compat.minimum)) {
      issues.push({
        file: systemPath,
        message: `compatibility.minimum '${compat.minimum}' is not valid semver`
      });
    }

    // ------------------------------------------------------------
    // Validate verified
    // ------------------------------------------------------------
    if (!compat.verified || typeof compat.verified !== "string") {
      issues.push({
        file: systemPath,
        message: "compatibility.verified must be a string"
      });
    } else if (!isSemver(compat.verified)) {
      issues.push({
        file: systemPath,
        message: `compatibility.verified '${compat.verified}' is not valid semver`
      });
    }

    // ------------------------------------------------------------
    // Validate ordering: minimum ≤ verified
    // ------------------------------------------------------------
    if (
      isSemver(compat.minimum) &&
      isSemver(compat.verified) &&
      compareSemver(compat.minimum, compat.verified) === 1
    ) {
      issues.push({
        file: systemPath,
        message: `compatibility.minimum (${compat.minimum}) cannot exceed compatibility.verified (${compat.verified})`
      });
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    function report() {
      if (issues.length > 0) {
        console.log("❌ validate-compatibility found issues:\n");
        for (const issue of issues) {
          console.log(` - ${issue.file} → ${issue.message}`);
        }
        if (strict) throw new Error("Compatibility validation failed");
      } else {
        console.log("✔ validate-compatibility passed");
      }
    }

    report();
  } catch (err) {
    console.log("⚠ validate-compatibility encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
