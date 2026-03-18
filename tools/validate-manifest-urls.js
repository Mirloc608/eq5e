// EQ5e Tool — Auto‑Generated Header

// tools/validate-manifest-urls.js
// Validates that the manifest and download URLs in system.json are reachable and correct.

export default async function validateManifestUrls({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const systemPath = path.join(root, "system.json");
    const errors = [];

    if (!fs.existsSync(systemPath)) {
      console.log("⚠ system.json not found");
      if (strict) throw new Error("Manifest URL validation failed");
      return;
    }

    const system = JSON.parse(fs.readFileSync(systemPath, "utf8"));
    const manifestUrl = system.manifest;
    const downloadUrl = system.download;

    if (!manifestUrl) {
      errors.push("Missing 'manifest' URL in system.json");
    }
    if (!downloadUrl) {
      errors.push("Missing 'download' URL in system.json");
    }

    // If missing fields, report early
    if (errors.length > 0) {
      console.log("❌ Manifest URL validation failed:\n");
      for (const err of errors) console.log(" - " + err);
      if (strict) throw new Error("Manifest URL validation failed");
      return;
    }

    // ------------------------------------------------------------
    // Validate manifest URL (must return JSON)
    // ------------------------------------------------------------
    try {
      const res = await fetch(manifestUrl, { method: "GET" });

      if (!res.ok) {
        errors.push(`manifest: HTTP ${res.status} ${res.statusText}`);
      } else {
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          errors.push(`manifest: Expected JSON but got ${contentType}`);
        } else {
          // Try parsing JSON
          try {
            await res.json();
          } catch {
            errors.push("manifest: Response was not valid JSON");
          }
        }
      }
    } catch (err) {
      errors.push(`manifest: Network error (${err.message})`);
    }

    // ------------------------------------------------------------
    // Validate download URL (must return 200)
    // ------------------------------------------------------------
    try {
      const res = await fetch(downloadUrl, { method: "GET" });

      if (!res.ok) {
        errors.push(`download: HTTP ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      errors.push(`download: Network error (${err.message})`);
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (errors.length > 0) {
      console.log("❌ Manifest URL validation failed:\n");
      for (const err of errors) console.log(" - " + err);
      if (strict) throw new Error("Manifest URL validation failed");
    } else {
      console.log("✔ validate-manifest-urls passed");
    }
  } catch (err) {
    console.log("⚠ validate-manifest-urls encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
