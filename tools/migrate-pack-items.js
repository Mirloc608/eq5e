import fs from "fs";
import path from "path";
import { validateItem } from "./validate-item-schema.js";
import { validateSpell } from "./validate-spell-schema.js";
import { validateDiscipline } from "./validate-discipline-schema.js";

const PACK_DIR = "packs";

function migrateFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split("\n").filter(l => l.trim().length);
  const migrated = [];

  for (const line of lines) {
    const doc = JSON.parse(line);
    if (doc.type === "spell") {
      normalizeSpell(doc);
      const { valid, errors } = validateSpell(doc);
      if (!valid) console.warn("Spell validation failed:", doc.name, errors);
    } else if (doc.type === "discipline") {
      normalizeDiscipline(doc);
      const { valid, errors } = validateDiscipline(doc);
      if (!valid) console.warn("Discipline validation failed:", doc.name, errors);
    } else {
      normalizeItem(doc);
      const { valid, errors } = validateItem(doc);
      if (!valid) console.warn("Item validation failed:", doc.name, errors);
    }
    migrated.push(JSON.stringify(doc));
  }

  fs.writeFileSync(filePath, migrated.join("\n") + "\n", "utf8");
}

function normalizeItem(doc) {
  doc.system = doc.system || {};
  doc.system.rarity = doc.system.rarity || "common";
  doc.system.weight = Number(doc.system.weight || 0);
  doc.system.description = doc.system.description || "";
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

function run() {
  const files = fs.readdirSync(PACK_DIR);
  for (const f of files) {
    if (!f.endsWith(".db")) continue;
    const full = path.join(PACK_DIR, f);
    console.log("Migrating pack:", full);
    migrateFile(full);
  }
}

run();
