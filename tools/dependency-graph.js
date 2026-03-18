// Canonical EQ5e dependency map.
// Keys = tool names
// Values = tools that must run BEFORE the key.
export const DEPENDENCIES = {
  // 🔧 FIXERS
  "fix-all": [],

  // 🔍 CORE VALIDATORS
  "validate-esm": ["fix-all"],
  "validate-require": ["fix-all"],
  "validate-github-actions": ["fix-all"],
  "validate-manifest-urls": ["fix-all"],
  "validate-schema-sync": ["fix-all"],
  "validate-sheet-path": ["fix-all"],

  // 📦 PACK VALIDATION CHAIN
  "validate-pack-extensions": ["fix-all"],
  "validate-pack-metadata": ["validate-pack-extensions"],
  "validate-pack-schema": ["validate-pack-metadata"],
  "validate-pack-types": ["validate-pack-schema"],
  "validate-pack-count": ["validate-pack-types"],
  "validate-packs": ["validate-pack-count"],

  // 🧠 SYSTEM VALIDATION
  "validate-system": ["validate-packs"],
  "validate-ts-model-sync": ["validate-system"],

  // 🏗️ GENERATORS
  "generate-pack-metadata": ["validate-packs"],
  "generate-release-notes": ["generate-pack-metadata"],
  "generate-changelog": ["generate-release-notes"],
  "generate-localization-stubs": ["validate-packs"],
  "generate-smoke-test-world": ["validate-packs"],
  "generate-tool-docs": ["validate-system"],

  // 📦 PACKAGING
  "generate-zip": ["validate-system"],

  // 🔍 ZIP VALIDATION
  "validate-zip-structure": ["generate-zip"],

  // 🚀 PUBLISHING
  "publish-release": ["generate-zip"],

  // 🎉 META RELEASE
  "release": [
    "fix-all",
    "validate-system",
    "generate-zip",
    "publish-release"
  ]
};

// Topological sort with cycle protection.
export function orderTools(tools) {
  const nameToTool = new Map(tools.map(t => [t.name, t]));
  const visited = new Map(); // name -> "temp" | "perm"
  const result = [];

  function visit(name) {
    const state = visited.get(name);
    if (state === "perm") return;
    if (state === "temp") return; // cycle detected → ignore

    visited.set(name, "temp");

    const deps = DEPENDENCIES[name] || [];
    for (const dep of deps) {
      if (nameToTool.has(dep)) {
        visit(dep);
      }
    }

    visited.set(name, "perm");

    if (nameToTool.has(name) && !result.find(t => t.name === name)) {
      result.push(nameToTool.get(name));
    }
  }

  // Visit all tools with dependencies
  for (const tool of tools) {
    visit(tool.name);
  }

  // Add any tools not referenced in the graph
  for (const tool of tools) {
    if (!result.find(t => t.name === tool.name)) {
      result.push(tool);
    }
  }

  return result;
}
