const { readdirSync } = require("node:fs");
const { join } = require("node:path");
const { execFileSync } = require("node:child_process");
function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) check(file);
    else if (/\.(?:js|cjs|mjs)$/.test(file))
      execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
  }
}
for (const directory of ["core", "ui", "desktop", "scripts", "tests"])
  check(directory);
