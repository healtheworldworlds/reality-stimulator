import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scripts = [
  ['scrape-code-hub.mjs', process.argv.slice(2)],
  ['scrape-telegram-ocr.mjs', process.argv.slice(2)],
];

for (const [script, scriptArgs] of scripts) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', script), ...scriptArgs], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
}
