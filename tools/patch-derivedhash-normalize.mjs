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
  if (!norm.includes("/scripts/")) return false;
  if (!(norm.endsWith(".js") || norm.endsWith(".mjs"))) return false;
  // Avoid backups
  if (norm.endsWith(".bak")) return false;
  return true;
}

function wrapNorm(expr) {
  // expr is something like "it" or "d"
  return `(game.eq5e?.normalizeItemData ? game.eq5e.normalizeItemData(${expr}) : ${expr})`;
}

function patchSource(src) {
  let s = src;
  let changed = false;

  // 1) Replace inline derivedHash assignments
  // d.flags.eq5e.derivedHash = stableHash(d);
  s = s.replace(
    /(\.flags\.eq5e\.derivedHash\s*=\s*)(stableHash|_stableHash)\s*\(\s*([A-Za-z0-9_$\.]+)\s*\)\s*;/g,
    (m, pre, fn, expr) => {
      changed = true;
      return `${pre}${fn}(${wrapNorm(expr)});`;
    }
  );

  // 2) Replace const h = stableHash(d);
  s = s.replace(
    /(const\s+h\s*=\s*)(stableHash|_stableHash)\s*\(\s*([A-Za-z0-9_$\.]+)\s*\)\s*;/g,
    (m, pre, fn, expr) => {
      changed = true;
      return `${pre}${fn}(${wrapNorm(expr)});`;
    }
  );

  // 3) Replace let h = ... (rare)
  s = s.replace(
    /(let\s+h\s*=\s*)(stableHash|_stableHash)\s*\(\s*([A-Za-z0-9_$\.]+)\s*\)\s*;/g,
    (m, pre, fn, expr) => {
      changed = true;
      return `${pre}${fn}(${wrapNorm(expr)});`;
    }
  );

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
  const { changed, out } = patchSource(src);

  if (!changed) { skippedCount++; skippedFiles.push(f); continue; }

  changedCount++;
  changedFiles.push(f);

  if (DRY) continue;

  const bak = f + ".bak";
  if (!fs.existsSync(bak)) writeFile(bak, src);
  writeFile(f, out);
}

console.log("EQ5E derivedHash normalization patch complete.");
console.log(`Root: ${rootAbs}`);
console.log(`Scanned: ${files.length} script file(s)`);
console.log(`Changed: ${changedCount}`);
console.log(`Skipped: ${skippedCount}`);

if (changedFiles.length) {
  console.log("\nChanged files:");
  for (const f of changedFiles) console.log(" - " + f);
}
if (DRY) console.log("\n(dry-run: no files written)");
