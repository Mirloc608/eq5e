#!/usr/bin/env node
// scripts/release-notes.js
// Simple release notes generator that writes CHANGELOG.md
// It collects commits since the previous tag and formats a short changelog.

const { execSync } = require("child_process");
const fs = require("fs");

function run(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function latestTag() {
  try {
    return run("git describe --tags --abbrev=0");
  } catch (e) {
    return null;
  }
}

function commitsSince(tag) {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  try {
    return run(`git log ${range} --pretty=format:"- %s (%an)"`);
  } catch (e) {
    return "";
  }
}

function header(tag) {
  const now = new Date().toISOString().split("T")[0];
  return `## ${tag || "Unreleased"} — ${now}\n\n`;
}

function main() {
  const tag = latestTag();
  const commits = commitsSince(tag);
  const changelog = header(tag) + (commits ? commits + "\n" : "- No commits found\n");

  const existing = fs.existsSync("CHANGELOG.md") ? fs.readFileSync("CHANGELOG.md", "utf8") : "";
  const out = changelog + "\n" + existing;
  fs.writeFileSync("CHANGELOG.md", out, "utf8");
  console.log("CHANGELOG.md updated");
}

main();
