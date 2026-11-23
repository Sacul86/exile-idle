// Removes the previous build output from the repo root before a new build.
import fs from 'fs';
for (const p of ['game', 'index.html', 'sprites', 'audio', 'icons', 'manifest.webmanifest', 'sw.js']) fs.rmSync(p, { recursive: true, force: true });
