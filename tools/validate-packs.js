// EQ5e Tool — Auto‑Generated Header

// tools/validate-packs.js
// Runs all pack-related validators and aggregates their results.

import validatePackExtensions from "./validate-pack-extensions.js";
import validatePackMetadata from "./validate-pack-metadata.js";
import validatePackSchema from "./validate-pack-schema.js";

export default async function validatePacks({ strict = false } = {}) {
  try {
    let failed = false;

    // Run each validator in sequence
    try {
      await validatePackExtensions({ strict: true });
    } catch {
      failed = true;
    }

    try {
      await validatePackMetadata({ strict: true });
    } catch {
      failed = true;
    }

    try {
      await validatePackSchema({ strict: true });
    } catch {
      failed = true;
    }

    if (failed) {
      console.log("❌ validate-packs failed");
      if (strict) throw new Error("Pack validation failed");
    } else {
      console.log("✔ validate-packs passed");
    }
  } catch (err) {
    console.log("⚠ validate-packs encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
