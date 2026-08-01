import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

if (!process.env.npm_execpath) throw new Error('package smoke must run through npm');
const packed = JSON.parse(execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--json', '--dry-run'], { encoding: 'utf8' }))[0];
const names = new Set(packed.files.map((file) => file.path));
for (const required of ['dist/index.js', 'dist/index.d.ts', 'dist/cli.js', 'dist/mcp.js', 'dist/storybook/preset.js', 'dist/figma.js', 'figma/manifest.json', 'figma/ui.html']) if (!names.has(required)) throw new Error(`package misses ${required}`);
const api = await import(pathToFileURL(`${process.cwd()}/dist/index.js`));
for (const name of ['parseContract', 'loadContract', 'inspectEvidence', 'verifyEvidence', 'collectDocument', 'designContext']) if (typeof api[name] !== 'function') throw new Error(`entrypoint misses ${name}`);
if (/node:fs|fs\/promises|require\(/.test(await readFile('dist/figma.js', 'utf8'))) throw new Error('Figma bundle is not browser-safe');
if (!execFileSync(process.execPath, ['dist/cli.js', '--help'], { encoding: 'utf8' }).includes('Usage: assay-design')) throw new Error('CLI binary did not execute');
console.log(JSON.stringify({ ok: true, files: packed.files.length, size: packed.size }));
