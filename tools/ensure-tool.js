// EQ5e Tool — Auto‑Generated Header

export default async function ensureTool() {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const toolsDir = __dirname;
  const testsDir = path.join(toolsDir, "tests");

  // 1. Ensure the single test runner exists
  const testRunner = path.join(testsDir, "all-tools-test.js");
  if (!fs.existsSync(testRunner)) {
    throw new Error("Missing tests/all-tools-test.js (single test runner required)");
  }

  // 2. Ensure no other test files exist
  const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith(".js"));
  const extraTests = testFiles.filter(f => f !== "all-tools-test.js");
  if (extraTests.length > 0) {
    throw new Error(
      `Unexpected test files found: ${extraTests.join(", ")}. Only all-tools-test.js is allowed.`
    );
  }

  // 3. Ensure tool scripts exist
  const toolFiles = fs.readdirSync(toolsDir)
    .filter(f => f.endsWith(".js") && f !== "cli.mjs");

  if (toolFiles.length === 0) {
    throw new Error("No tool scripts found in /tools");
  }

  // 4. Ensure naming rules
  const badNames = toolFiles.filter(f => !/^[a-z0-9\-]+\.js$/.test(f));
  if (badNames.length > 0) {
    throw new Error(
      `Invalid tool filenames: ${badNames.join(", ")}`
    );
  }

  // 5. Ensure no test files in /tools
  const misplacedTests = fs.readdirSync(toolsDir)
    .filter(f => f.endsWith("-test.js"));
  if (misplacedTests.length > 0) {
    throw new Error(
      `Test files found in /tools: ${misplacedTests.join(", ")}. Move them to /tools/tests.`
    );
  }

  return true;
}

// End of EQ5e Tool
