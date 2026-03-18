#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import os from "node:os";
import { runInParallel } from "./parallel.js";
import { orderTools } from "./dependency-graph.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const toolsDir = __dirname;

// CLI flags
const args = process.argv.slice(2);
const strictMode = args.includes("--strict");
const summaryMode = args.includes("--summary");

// Discover all tool scripts
function discoverTools() {
  const files = fs.readdirSync(toolsDir);

  return files
    .filter(f =>
      f.endsWith(".js") &&
      f !== "cli.mjs" &&
      f !== "parallel.js" &&
      f !== "dependency-graph.js"
    )
    .map(f => ({
      name: f.replace(".js", ""),
      file: path.join(toolsDir, f)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Run a single tool
async function runTool(tool) {
  const mod = await import(url.pathToFileURL(tool.file).href);

  if (typeof mod.default !== "function") {
    return {
      name: tool.name,
      passed: false,
      error: new Error("Tool does not export a default function")
    };
  }

  try {
    await mod.default({ strict: strictMode });
    return { name: tool.name, passed: true };
  } catch (err) {
    return { name: tool.name, passed: false, error: err };
  }
}

// Main execution
async function main() {
  let tools = discoverTools();

  if (tools.length === 0) {
    console.log("No matching scripts to run.");
    return;
  }

  // Apply dependency graph ordering
  tools = orderTools(tools);

  const results = [];

  if (strictMode) {
    // Sequential execution
    for (const tool of tools) {
      if (!summaryMode) {
        console.log(`\n=== ${tool.name.padEnd(35)} ===`);
      }

      const result = await runTool(tool);

      if (!summaryMode) {
        if (result.passed) {
          console.log(`✔ ${tool.name} passed`);
        } else {
          console.log(`❌ ${tool.name} failed`);
          console.error(result.error);
        }
      }

      results.push(result);
    }
  } else {
    // Parallel execution
    const concurrency = Math.max(2, Math.floor(os.cpus().length / 2));

    const parallelResults = await runInParallel(
      tools,
      async tool => {
        if (!summaryMode) {
          console.log(`\n=== ${tool.name.padEnd(35)} ===`);
        }

        const result = await runTool(tool);

        if (!summaryMode) {
          if (result.passed) {
            console.log(`✔ ${tool.name} passed`);
          } else {
            console.log(`❌ ${tool.name} failed`);
          }
        }

        return result;
      },
      { concurrency }
    );

    results.push(...parallelResults);
  }

  // Summary mode
  if (summaryMode) {
    console.log("\n=== Summary ===\n");
    for (const r of results) {
      console.log(`${r.name.padEnd(25)} ${r.passed ? "PASS" : "FAIL"}`);
    }
  }

  const failures = results.filter(r => !r.passed);
  if (failures.length > 0) {
    console.log("\n❌ One or more tools failed\n");
    process.exit(strictMode ? 1 : 0);
  } else {
    console.log("\n✔ All tools passed\n");
  }
}

main();
