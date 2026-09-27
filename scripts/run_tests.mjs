import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Pass explicit filenames: directory arguments differ between Node 20 and 24,
// and shell wildcard expansion differs between Windows and Linux.
const directory = path.resolve(process.argv[2] || "tests");
const files = (await readdir(directory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.test\.(mjs|js)$/.test(entry.name))
  .map((entry) => path.join(directory, entry.name))
  .sort();
if (!files.length) throw new Error(`No test files found in ${directory}`);
const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
