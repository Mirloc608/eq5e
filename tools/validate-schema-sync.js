// EQ5e Tool — Auto‑Generated Header

// tools/validate-schema-sync.js
// Ensures system.json types match template.json types exactly.

export default async function validateSchemaSync({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const systemPath = path.join(root, "system.json");
    const templatePath = path.join(root, "template.json");

    const errors = [];

    if (!fs.existsSync(systemPath)) {
      errors.push("Missing system.json");
    }
    if (!fs.existsSync(templatePath)) {
      errors.push("Missing template.json");
    }

    if (errors.length > 0) {
      console.log("❌ validate-schema-sync found issues:\n");
      for (const err of errors) console.log(" - " + err);
      if (strict) throw new Error("Schema sync validation failed");
      return;
    }

    const system = JSON.parse(fs.readFileSync(systemPath, "utf8"));
    const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));

    // Extract types from system.json
    const systemActorTypes = new Set(system.types?.Actor?.types ?? []);
    const systemItemTypes = new Set(system.types?.Item?.types ?? []);

    // Extract types from template.json
    const templateActorTypes = new Set(Object.keys(template.Actor ?? {}));
    const templateItemTypes = new Set(Object.keys(template.Item ?? {}));

    // Compare Actor types
    for (const t of systemActorTypes) {
      if (!templateActorTypes.has(t)) {
        errors.push(`Actor type in system.json but missing in template.json: ${t}`);
      }
    }
    for (const t of templateActorTypes) {
      if (!systemActorTypes.has(t)) {
        errors.push(`Actor template key in template.json but missing in system.json: ${t}`);
      }
    }

    // Compare Item types
    for (const t of systemItemTypes) {
      if (!templateItemTypes.has(t)) {
        errors.push(`Item type in system.json but missing in template.json: ${t}`);
      }
    }
    for (const t of templateItemTypes) {
      if (!systemItemTypes.has(t)) {
        errors.push(`Item template key in template.json but missing in system.json: ${t}`);
      }
    }

    // Report
    if (errors.length > 0) {
      console.log("❌ schema-sync validation failed:\n");
      for (const err of errors) console.log(" - " + err);
      if (strict) throw new Error("Schema sync validation failed");
    } else {
      console.log("✔ validate-schema-sync passed");
    }
  } catch (err) {
    console.log("⚠ validate-schema-sync encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
