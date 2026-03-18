import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = process.cwd();
const TARGET_SCRIPTS = {
  "validate:packs": "node tools/validate-all-packs.js",
  "repair:packs": "node tools/auto-repair-schema.js",
  "migrate:packs": "node tools/migrate-pack-items.js"
};

console.log("=== EQ5e Package.json Locator & Patcher ===\n");

/* ---------------------------------------------------------
   1. Find ALL package.json files under the system folder
--------------------------------------------------------- */

function findAllPackageJson(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results = results.concat(findAllPackageJson(full));
    } else if (entry.name === "package.json") {
      results.push(full);
    }
  }
  return results;
}

const allPackages = findAllPackageJson(ROOT);

if (allPackages.length === 0) {
  console.error("❌ No package.json files found under:", ROOT);
  process.exit(1);
}

console.log("Found package.json files:");
allPackages.forEach(p => console.log(" •", p));

/* ---------------------------------------------------------
   2. Determine which package.json npm is ACTUALLY using
--------------------------------------------------------- */

function findNpmPackageJson() {
  // npm always resolves from the working directory upward
  let dir = ROOT;

  while (true) {
    const candidate = path.join(dir, "package.json");
    if (fs.existsSync(candidate)) return candidate;

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

const npmPackageJson = findNpmPackageJson();

console.log("\nnpm is using this package.json:");
console.log(" →", npmPackageJson);

/* ---------------------------------------------------------
   3. Patch the correct package.json with missing scripts
--------------------------------------------------------- */

function patchPackageJson(filePath) {
  const pkg = JSON.parse(fs.readFileSync(filePath, "utf8"));

  pkg.scripts = pkg.scripts || {};

  let added = 0;
  for (const [key, value] of Object.entries(TARGET_SCRIPTS)) {
    if (!pkg.scripts[key]) {
      pkg.scripts[key] = value;
      added++;
    }
  }

  if (added > 0) {
    fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2));
    console.log(`\n✔ Patched ${added} missing scripts into:`);
    console.log(" →", filePath);
  } else {
    console.log("\n✔ All required scripts already exist in:");
    console.log(" →", filePath);
  }
}

patchPackageJson(npmPackageJson);

/* ---------------------------------------------------------
   4. Final instructions
--------------------------------------------------------- */

console.log(`
=== Done ===

Now run:

  npm install
  npm run

You should now see:
  validate:packs
  repair:packs
  migrate:packs
`);
