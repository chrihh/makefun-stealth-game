// Night Ledger — entrypoint for "Make the best stealth game"
// (best-stealth-game-20261121-1759), Node 22, standard library only.
//
// The game itself is the static site in game/: a top-down stealth burglary
// in three floors, drawn on a canvas, playable offline in a desktop browser
// with keyboard and mouse and no network request. This program hands it in:
// it copies game/ and screenshots/ into the output directory and writes the
// dossier the judge reads, built with the kit's vendored library so the
// gate can rebuild it byte for byte and compare.
//
// Run it the way the grader does, or locally with an output override:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play the game with:  node serve.ts   (then open http://localhost:8080)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The dossier caps mirror the gate's own limits for this competition, so an
// entry this program produces is one the scorer will accept: at most four
// screenshots of 256 KiB each, at most 993 game files totalling 48 MiB, and
// no game path longer than 1000 bytes.
const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });

mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
const screenshotsHere = join(repoRoot, 'screenshots');
if (existsSync(screenshotsHere)) {
  cpSync(screenshotsHere, join(outputDir, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(outputDir, DOSSIER_LIMITS);
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`Night Ledger handed in to ${outputDir} (dossier ${dossier.length} bytes).`);
