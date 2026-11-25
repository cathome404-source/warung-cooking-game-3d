// SPDX-License-Identifier: MIT
// Kuali Emas 3D — hand-in program for the make.fun best cooking game bounty.
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json by calling buildDossier from the kit's vendor library.
// Node 22, standard library only. Deterministic: files are copied in sorted
// order, no timestamps or random values are written anywhere, so two runs
// produce byte-identical output trees.
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const repoRoot: string = dirname(fileURLToPath(import.meta.url));

// Resolve the output directory. MAKEFUN_OUTPUT_DIR wins when set;
// otherwise the absolute /output (the grader's writable output dir).
// A relative "output" is only a fallback when /output cannot be created
// at all — never the default, since a relative path fails with EACCES
// under the grader's read-only repo directory.
// Never remove the output directory itself: the program may not have
// permission to remove the /output mount point. Only its contents.
function resolveOutDir(): string {
  const envDir: string | undefined = process.env.MAKEFUN_OUTPUT_DIR;
  if (envDir) {
    return resolve(envDir);
  }
  try {
    mkdirSync("/output", { recursive: true });
    return "/output";
  } catch {
    // mkdir failed: use /output anyway if it already exists, otherwise
    // fall back to a relative output folder under the current directory.
    try {
      if (statSync("/output").isDirectory()) {
        return "/output";
      }
    } catch {
      // /output does not exist — fall through to the relative fallback.
    }
    return resolve("output");
  }
}

const outDir: string = resolveOutDir();

if (outDir === repoRoot) {
  throw new Error("refusing to use the repository root as the output directory");
}

// Create the output directory (if needed) and clear only its contents,
// never the directory itself. Clearing is best-effort per child: a stale
// entry owned by someone else must not fail the whole run — the files
// this program writes are overwritten unconditionally below.
function prepareOutDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const entry of readdirSync(dir).sort()) {
    try {
      rmSync(join(dir, entry), { recursive: true, force: true });
    } catch (err) {
      console.warn(`warning: could not remove stale ${join(dir, entry)}: ${(err as Error).message}`);
    }
  }
}

// Copy one directory tree into another, entries in sorted (byte) order, so
// the output tree is identical on every run regardless of filesystem order.
function copyTreeSorted(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  const entries: string[] = readdirSync(src).sort();
  for (const entry of entries) {
    const from: string = join(src, entry);
    const to: string = join(dest, entry);
    if (statSync(from).isDirectory()) {
      copyTreeSorted(from, to);
    } else {
      copyFileSync(from, to);
    }
  }
}

prepareOutDir(outDir);
copyTreeSorted(join(repoRoot, "game"), join(outDir, "game"));
copyTreeSorted(join(repoRoot, "screenshots"), join(outDir, "screenshots"));

const dossier: Uint8Array = await buildDossier(repoRoot, { text_max_bytes: 163840 });
writeFileSync(join(outDir, "dossier.json"), dossier);
console.log(`wrote ${outDir}`);
