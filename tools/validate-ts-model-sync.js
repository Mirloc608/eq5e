// EQ5e Tool — Auto‑Generated Header

// tools/validate-ts-model-sync.js
// Ensures that the generated TypeScript model file exists.

export default async function validateTsModelSync({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const modelPath = path.join(root, "eq5e.generated.d.ts");
    const errors = [];

    // Check for existence
    if (!fs.existsSync(modelPath)) {
      errors.push("Missing eq5e.generated.d.ts (TS model not generated)");
    }

    // Report
    if (errors.length > 0) {
      console.log("❌ validate-ts-model-sync found issues:\n");
      for (const err of errors) console.log(" - " + err);
      if (strict) throw new Error("Missing TS model");
    } else {
      console.log("✔ validate-ts-model-sync passed");
    }
  } catch (err) {
    console.log("⚠ validate-ts-model-sync encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
