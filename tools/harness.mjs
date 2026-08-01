import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

async function files(directory) {
  return (await Promise.all((await readdir(directory, { withFileTypes: true })).map((entry) => entry.isDirectory() ? files(join(directory, entry.name)) : entry.name.endsWith('.ts') ? [join(directory, entry.name)] : []))).flat();
}
const sourceFiles = await files('src');
const counts = await Promise.all(sourceFiles.map(async (file) => ({ file, lines: (await readFile(file, 'utf8')).split(/\r?\n/).filter((line) => line.trim()).length })));
const total = counts.reduce((sum, item) => sum + item.lines, 0);
const oversized = counts.filter((item) => item.lines > 500);
if (total > 500 || oversized.length) throw new Error(`LOC budget failed: total=${total}; oversized=${oversized.map((item) => item.file).join(',') || 'none'}`);
const coverage = JSON.parse(await readFile('coverage/coverage-summary.json', 'utf8')).total;
for (const metric of ['lines', 'statements', 'functions']) if (coverage[metric].pct < 95) throw new Error(`${metric} coverage ${coverage[metric].pct}% is below 95%`);
if (coverage.branches.pct < 90) throw new Error(`branch coverage ${coverage.branches.pct}% is below 90%`);
console.log(JSON.stringify({ ok: true, runtimeLoc: total, maxFileLoc: Math.max(...counts.map((item) => item.lines)), coverage: Object.fromEntries(Object.entries(coverage).map(([key, value]) => [key, value.pct])) }));
