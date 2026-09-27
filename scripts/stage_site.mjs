// Explicit public runtime allowlist. Discovery, prompts, tests and tooling stay out.
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.resolve(root, process.argv[2] || "_site");
if (!output.startsWith(`${root}${path.sep}`) || output === root) throw new Error("Staging must use a new directory inside the repository.");
// Refuse stale directories instead of deleting anything or shipping stale files.
await mkdir(output);
const files = [
  "index.html", "about.html", "resources.html", "secondary.css",
  "upcoming-events.html", "upcoming-events.js", "upcoming-events.css",
  "data/upcoming-events.json", "poi/index.html", "poi/manifest.webmanifest", "poi/sw.js",
];
const directories = ["assets", "poi/css", "poi/data", "poi/icons", "poi/js", "poi/vendor"];
for (const entry of [...files, ...directories]) {
  await mkdir(path.dirname(path.join(output, entry)), { recursive: true });
  await cp(path.join(root, entry), path.join(output, entry), { recursive: true });
}
const index = await readFile(path.join(output, "index.html"));
const editions = JSON.parse(await readFile(path.join(root, "data/editions.json"), "utf8"));
const manifest = {
  commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  issueLabel: editions.issues.today.label,
  indexSha256: createHash("sha256").update(index).digest("hex"),
};
await writeFile(path.join(output, "deployment.json"), JSON.stringify(manifest, null, 2) + "\n");
await writeFile(path.join(output, ".nojekyll"), "");
console.log(`Staged public runtime files in ${path.relative(root, output)} (${manifest.commit}).`);
