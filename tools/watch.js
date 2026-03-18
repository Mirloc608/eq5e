// EQ5e Tool — Auto‑Generated Header

export default async function watch({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");
  const { exec } = await import("node:child_process");

  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const root = path.resolve(__dirname, "..");

  const WATCH_DIRS = [
    path.join(root, "packs"),
    path.join(root, "module"),
    path.join(root, "templates"),
    path.join(root, "lang"),
    path.join(root, "styles"),
    path.join(root, "scripts"),
    path.join(root, "src"),
    root
  ];

  console.log("👀 EQ5e Watch Mode");
  console.log("Watching for changes...\n");

  let timer = null;
  const DEBOUNCE_MS = 300;

  function runValidators() {
    console.log("\n🔄 Change detected — running validators...\n");

    exec(`node tools/cli.mjs --strict --summary`, (err, stdout, stderr) => {
      console.log(stdout);
      if (stderr) console.error(stderr);

      if (err) {
        console.log("❌ Validators reported issues");
      } else {
        console.log("✔ Validators passed");
      }

      console.log("\n👀 Watching for more changes...\n");
    });
  }

  function debounceRun() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(runValidators, DEBOUNCE_MS);
  }

  for (const dir of WATCH_DIRS) {
    if (!fs.existsSync(dir)) continue;

    fs.watch(dir, { recursive: true }, (event, filename) => {
      if (!filename) return;
      debounceRun();
    });
  }
}

// End of EQ5e Tool
