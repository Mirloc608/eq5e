#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function argValue(flag, fallback=null) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return fallback;
  return process.argv[i+1] ?? fallback;
}
const ROOT = argValue("--root", ".");
const DRY = process.argv.includes("--dry-run");

function readFile(p) { return fs.readFileSync(p, "utf8"); }
function writeFile(p, s) { fs.writeFileSync(p, s, "utf8"); }

function listFiles(root) {
  const out = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && (p.endsWith(".js") || p.endsWith(".mjs"))) out.push(p);
    }
  }
  walk(root);
  return out;
}

function isTargetFile(p) {
  const norm = p.split(path.sep).join("/");
  if (!norm.includes("/systems/eq5e/bundles/")) return false;
  if (norm.endsWith("/main.js") || norm.endsWith("/scripts/main.js")) return true;
  if (norm.includes("/scripts/") && norm.endsWith(".js")) return true;
  return false;
}

// v1: comment block
const RE_IN_FUNCTION_BLOCK = /(\n\s*\/\/\s*Normalize embedded ActiveEffects[\s\S]*?\n\s*const normalizeItem\s*=\s*\(it\)\s*=>\s*\{[\s\S]*?\n\s*\};\n)/m;

// v2: full inline const block
const RE_INLINE_CONST_BLOCK = /(\n\s*const\s+isValid16Id\s*=\s*\(id\)\s*=>[\s\S]*?\n\s*const\s+stableId16\s*=\s*\(obj\)\s*=>[\s\S]*?\n\s*const\s+normalizeEffects\s*=\s*\(effects\)\s*=>[\s\S]*?\n\s*const\s+normalizeItem\s*=\s*\(it\)\s*=>[\s\S]*?\n\s*\};\n)/m;

// v3: partial inline const block (no normalizeItem)
const RE_PARTIAL_INLINE_BLOCK = /(\n\s*const\s+isValid16Id\s*=\s*\(id\)\s*=>[\s\S]*?\n\s*const\s+stableId16\s*=\s*\(obj\)\s*=>[\s\S]*?\n\s*const\s+normalizeEffects\s*=\s*\(effects\)\s*=>[\s\S]*?\n\s*\};\n)/m;

// top-level helper defs
const RE_TOP_HELPERS = /(\nfunction\s+_isValid16Id\([\s\S]*?\nfunction\s+_normalizeItemForFoundry\([\s\S]*?\n\}\n)/m;

function rewriteNormalizationCalls(s) {
  // Replace any normalizeItem/raw or _normalizeItemForFoundry/raw usage
  const repl = "const it = game.eq5e?.normalizeItemData ? game.eq5e.normalizeItemData(raw) : foundry.utils.duplicate(raw);";
  s = s.replace(/const\s+it\s*=\s*normalizeItem\s*\(\s*raw\s*\)\s*;/g, repl);
  s = s.replace(/const\s+it\s*=\s*_normalizeItemForFoundry\s*\(\s*raw\s*\)\s*;/g, repl);

  // If code assigns data.effects = normalizeEffects(data.effects); replace with normalizeItemData helper
  s = s.replace(
    /(\bdata\.effects\s*=\s*)normalizeEffects\s*\(\s*data\.effects\s*\)\s*;/g,
    `$1(game.eq5e?.normalizeItemData ? game.eq5e.normalizeItemData({ effects: data.effects }).effects : data.effects);`
  );

  // If it uses normalizeEffects directly on arbitrary var: normalizeEffects(x)
  s = s.replace(
    /\bnormalizeEffects\s*\(\s*([A-Za-z0-9_$.]+)\s*\)/g,
    `(game.eq5e?.normalizeItemData ? game.eq5e.normalizeItemData({ effects: $1 }).effects : $1)`
  );

  return s;
}

function cleanupFile(src) {
  let s = src;
  let changed = false;

  for (const re of [RE_IN_FUNCTION_BLOCK, RE_INLINE_CONST_BLOCK, RE_PARTIAL_INLINE_BLOCK, RE_TOP_HELPERS]) {
    if (re.test(s)) { s = s.replace(re, "\n"); changed = true; }
  }

  const s2 = rewriteNormalizationCalls(s);
  if (s2 !== s) { s = s2; changed = true; }

  return { changed, out: s };
}

const rootAbs = path.resolve(ROOT);
const files = listFiles(rootAbs).filter(isTargetFile);

let changedCount = 0;
let skippedCount = 0;
const changedFiles = [];
const skippedFiles = [];

for (const f of files) {
  const src = readFile(f);
  const { changed, out } = cleanupFile(src);
  if (!changed) { skippedCount++; skippedFiles.push(f); continue; }

  changedCount++;
  changedFiles.push(f);

  if (DRY) continue;

  const bak = f + ".bak";
  if (!fs.existsSync(bak)) writeFile(bak, src);
  writeFile(f, out);
}

console.log("EQ5E cleanup complete (v3).");
console.log(`Root: ${rootAbs}`);
console.log(`Scanned: ${files.length} target file(s)`);
console.log(`Changed: ${changedCount}`);
console.log(`Skipped: ${skippedCount}`);

if (changedFiles.length) {
  console.log("\nChanged files:");
  for (const f of changedFiles) console.log(" - " + f);
}
if (skippedFiles.length) {
  console.log("\nSkipped files (no matched duplication):");
  for (const f of skippedFiles) console.log(" - " + f);
}

if (DRY) console.log("\n(dry-run: no files written)");
