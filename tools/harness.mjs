import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const MAX_FILE_LINES = 500;

const result = spawnSync('tokei', ['src', '--output', 'json'], { encoding: 'utf8' });
if (result.error) throw new Error(`could not start tokei: ${result.error.message}`);
if (result.status !== 0) throw new Error(`tokei failed: ${(result.stderr || result.stdout).trim()}`);

const report = JSON.parse(result.stdout);
const languages = ['TypeScript', 'TSX', 'JavaScript'];
const total = languages.reduce((sum, language) => sum + (report[language]?.code ?? 0), 0);
const files = languages.flatMap((language) =>
  (report[language]?.reports ?? []).map((item) => ({ file: item.name, lines: item.stats?.code ?? 0 })),
);
const oversized = files.filter((item) => item.lines > MAX_FILE_LINES);

if (oversized.length) throw new Error(`production file budget exceeded (>${MAX_FILE_LINES} tokei code lines): ${JSON.stringify(oversized)}`);

const coverage = JSON.parse(await readFile('coverage/coverage-summary.json', 'utf8')).total;
for (const metric of ['lines', 'statements', 'functions']) if (coverage[metric].pct < 95) throw new Error(`${metric} coverage ${coverage[metric].pct}% is below 95%`);
if (coverage.branches.pct < 90) throw new Error(`branch coverage ${coverage.branches.pct}% is below 90%`);

console.log(JSON.stringify({
  ok: true,
  runtimeLoc: total,
  maxFileLoc: Math.max(0, ...files.map((item) => item.lines)),
  budgets: { file: MAX_FILE_LINES },
  coverage: Object.fromEntries(Object.entries(coverage).map(([key, value]) => [key, value.pct])),
}));
