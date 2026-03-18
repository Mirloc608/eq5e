import fs from "fs";
import path from "path";
import { detectSchemaDir } from "./schema-loader.js";

function listDir(dir, indent = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    console.log(indent + (entry.isDirectory() ? "📁 " : "📄 ") + entry.name);
    if (entry.isDirectory()) {
      listDir(full, indent + "   ");
    }
  }
}

console.log("=== EQ5e Directory Debugger ===\n");

console.log("Working directory:");
console.log(" →", process.cwd(), "\n");

console.log("System tree:");
listDir(process.cwd());
console.log("");

try {
  const schemaDir = detectSchemaDir();
  console.log("Detected schema directory:");
  console.log(" →", schemaDir, "\n");

  console.log("Schema files:");
  const files = fs.readdirSync(schemaDir);
  files.forEach(f => console.log(" •", f));
} catch (err) {
  console.error(err.message);
}

console.log("\n=== Done ===");
