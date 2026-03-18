import fs from "fs";
import path from "path";
import { validateItem } from "./validate-item-schema.js";
import { validateSpell } from "./validate-spell-schema.js";
import { validateDiscipline } from "./validate-discipline-schema.js";

const PACK_DIR = "packs";
const BACKUP_DIR = "packs_backup";

/* ---------------- Core runner ---------------- */

function run() {
  console.log("=== EQ5e Schema Auto-Repair ===");

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
  }

  const files = fs.readdirSync(PACK_DIR).filter(f => f.endsWith(".db"));

  for (const f of files) {
    const src = path.join(PACK_DIR, f);
    const backup = path.join(BACKUP_DIR, f);

    if (!fs.existsSync(backup)) {
      fs.copyFileSync(src, backup);
      console.log(`📦 Backup created: ${backup}`);
    }

    autoRepairFile(src);
  }

  console.log("\n✅ Auto-repair complete.");
}

function autoRepairFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split("\n").filter(l => l.trim().length);
  const repaired = [];

  let total = 0;
  let repairedCount = 0;

  console.log(`\n▶ Auto-repairing: ${filePath}`);

  for (const line of lines) {
    let doc;
    try {
      doc = JSON.parse(line);
    } catch (err) {
      console.warn("⚠ Invalid JSON, skipping:", filePath, err);
      continue;
    }

    total++;

    switch (doc.type) {
      case "spell":
        normalizeSpell(doc);
        repairedCount += repairWithValidation(doc, validateSpell);
        break;
      case "discipline":
        normalizeDiscipline(doc);
        repairedCount += repairWithValidation(doc, validateDiscipline);
        break;
      default:
        normalizeItem(doc);
        repairedCount += repairWithValidation(doc, validateItem);
        break;
    }

    repaired.push(JSON.stringify(doc));
  }

  fs.writeFileSync(filePath, repaired.join("\n") + "\n", "utf8");
  console.log(`✔ Repaired: ${filePath} — ${repairedCount}/${total} docs adjusted`);
}

/* ------------- Repair + validate ------------- */

function repairWithValidation(doc, validator) {
  const { valid, errors } = validator(doc);
  if (valid) return 0;

  console.warn(`⚠ Initial validation failed for "${doc.name}" (${doc._id}). Attempting deeper repair.`);
  // At this point we already normalized; deeper repair hooks could go here.
  // Re-run validation after any extra repair logic.
  const second = validator(doc);
  if (!second.valid) {
    console.warn(`❌ Still invalid after repair: "${doc.name}" (${doc._id})`);
    console.warn(second.errors);
  }
  return 1;
}

/* ------------- Normalization helpers ---------- */

function normalizeItem(doc) {
  doc.system = doc.system || {};

  doc.system.rarity = doc.system.rarity || "common";
  doc.system.weight = Number(doc.system.weight || 0);
  doc.system.description = doc.system.description || "";

  doc.system.stats = normalizeNumericMap(doc.system.stats);
  doc.system.resists = normalizeNumericMap(doc.system.resists);
}

function normalizeSpell(doc) {
  doc.system = doc.system || {};

  doc.system.level = Number(doc.system.level || 1);
  doc.system.manaCost = Number(doc.system.manaCost || 0);
  doc.system.castTime = Number(doc.system.castTime || 0);
  doc.system.recastTime = Number(doc.system.recastTime || 0);
  doc.system.duration = Number(doc.system.duration || 0);
  doc.system.range = Number(doc.system.range || 0);

  doc.system.resistType = doc.system.resistType || "";
  doc.system.school = doc.system.school || doc.system.resistType || "";

  doc.system.rarity = doc.system.rarity || "common";
  doc.system.description = doc.system.description || "";
}

function normalizeDiscipline(doc) {
  doc.system = doc.system || {};

  doc.system.tier = doc.system.tier || "";
  doc.system.enduranceCost = Number(doc.system.enduranceCost || 0);
  doc.system.reuseTime = Number(doc.system.reuseTime || 0);
  doc.system.duration = Number(doc.system.duration || 0);
  doc.system.category = doc.system.category || "";

  doc.system.rarity = doc.system.rarity || "common";
  doc.system.description = doc.system.description || "";
}

function normalizeNumericMap(obj) {
  if (!obj || typeof obj !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = Number(v || 0);
  }
  return out;
}

run();
