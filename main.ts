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
const outDir: string = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");

if (outDir === repoRoot) {
  throw new Error("refusing to use the repository root as the output directory");
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

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
copyTreeSorted(join(repoRoot, "game"), join(outDir, "game"));
copyTreeSorted(join(repoRoot, "screenshots"), join(outDir, "screenshots"));

const dossier: Uint8Array = await buildDossier(repoRoot, { text_max_bytes: 163840 });
writeFileSync(join(outDir, "dossier.json"), dossier);
console.log(`wrote ${outDir}`);
