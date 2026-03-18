import fs from "fs";
import path from "path";

/**
 * Auto-detect the correct schema directory.
 * Returns an absolute path to the schema folder.
 */
export function detectSchemaDir() {
  const candidates = [
    "system/schema",
    "systems/schema",
    "schema",
    "system/schemas",
    "systems/schemas"
  ];

  for (const rel of candidates) {
    const full = path.resolve(process.cwd(), rel);
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
      return full;
    }
  }

  throw new Error(
    "❌ Could not locate schema directory. Expected one of:\n" +
    candidates.map(c => ` - ${c}`).join("\n")
  );
}

/**
 * Load a schema JSON file by name (e.g., "item.json").
 */
export function loadSchema(name) {
  const schemaDir = detectSchemaDir();
  const filePath = path.join(schemaDir, name);

  if (!fs.existsSync(filePath)) {
    throw new Error(`❌ Schema file not found: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
