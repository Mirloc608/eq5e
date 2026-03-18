import fs from "fs";
import path from "path";
import { validateItem } from "./validate-item-schema.js";
import { validateSpell } from "./validate-spell-schema.js";
import { validateDiscipline } from "./validate-discipline-schema.js";

const PACK_DIR = "packs";

function validateFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split("\n").filter(l => l.trim().length);

  let total = 0;
  let failed = 0;

  console.log(`\n▶ Validating: ${filePath}`);

  for (const line of lines) {
    let doc;
    try {
      doc = JSON.parse(line);
    } catch (err) {
      console.warn("⚠ Invalid JSON:", filePath, err);
      failed++;
      continue;
    }

    total++;

    let result;
    if (doc.type === "spell") {
      result = validateSpell(doc);
    } else if (doc.type === "discipline") {
      result = validateDiscipline(doc);
    } else {
      result = validateItem(doc);
    }

    if (!result.valid) {
      failed++;
      console.warn(`⚠ Validation failed for "${doc.name}" (${doc._id}):`);
      console.warn(result.errors);
    }
  }

  console.log(`✔ Done: ${filePath} — ${total - failed}/${total} valid`);
  return { total, failed };
}

function run() {
  console.log("=== EQ5e Pack Validation ===");

  const files = fs.readdirSync(PACK_DIR).filter(f => f.endsWith(".db"));
  let grandTotal = 0;
  let grandFailed = 0;

  for (const f of files) {
    const { total, failed } = validateFile(path.join(PACK_DIR, f));
    grandTotal += total;
    grandFailed += failed;
  }

  console.log("\n=== Summary ===");
  console.log(`Total docs:   ${grandTotal}`);
  console.log(`Failed docs:  ${grandFailed}`);

  if (grandFailed > 0) {
    console.error("❌ Validation failed.");
    process.exitCode = 1;
  } else {
    console.log("✅ All packs valid.");
  }
}

run();
