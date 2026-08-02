/* global console, process */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { inspectEvidence, parseContract, verifyEvidence } from '../dist/index.js';
import { CATEGORIES, DOMAINS, TOKENS, contractSource, correctedEvidence, vulnerableEvidence } from './catalog.mjs';

const DEFAULT_CORPORA = [1_024, 10_000];

function corpora(argv) {
  const selected = [];
  for (let index = 0; index < argv.length; index += 1) if (argv[index] === '--corpus') {
    const size = Number(argv[index + 1]);
    if (!Number.isSafeInteger(size) || size < 1) throw new Error('--corpus must be a positive integer');
    selected.push(size); index += 1;
  }
  return selected.length ? selected : DEFAULT_CORPORA;
}

const contracts = new Map(DOMAINS.map((domain) => [domain.id, { ...parseContract(contractSource(domain)), tokens: TOKENS }]));
const round = (value) => Number(value.toFixed(2));

async function calibrate(version) {
  const cases = [];
  let falseAlarms = 0;
  let missedMutants = 0;
  for (const domain of DOMAINS) {
    const contract = contracts.get(domain.id);
    const corrected = correctedEvidence(domain);
    const controlFindings = inspectEvidence(contract, corrected);
    const controlVerdict = await verifyEvidence(contract, corrected);
    if (controlFindings.length || controlVerdict.outcome !== 'pass') falseAlarms += 1;
    const mutants = [];
    for (const category of CATEGORIES) {
      const evidence = vulnerableEvidence(domain, category);
      const findings = inspectEvidence(contract, evidence);
      const verdict = await verifyEvidence(contract, evidence);
      const categories = [...new Set(findings.map((finding) => finding.category))];
      const exact = categories.length === 1 && categories[0] === category && verdict.outcome === 'fail' && verdict.results.filter((result) => result.status === 'fail').length === 1;
      if (!exact) missedMutants += 1;
      mutants.push({ category, findings: findings.length, detectedCategories: categories, outcome: verdict.outcome, exact });
    }
    cases.push({ domain: domain.id, corrected: { findings: controlFindings.length, outcome: controlVerdict.outcome }, mutants });
  }
  return {
    schema: 1, benchmark: 'assay-design-domain-calibration', version,
    corpus: { domains: DOMAINS.length, correctedControls: DOMAINS.length, mutants: DOMAINS.length * CATEGORIES.length, categories: CATEGORIES },
    accuracy: { detectedMutants: DOMAINS.length * CATEGORIES.length - missedMutants, missedMutants, falseAlarms },
    cases, passed: !falseAlarms && !missedMutants,
    limitations: ['Fixtures are deterministic and synthetic.', 'This measures declared design-system conformance, not subjective beauty or usability.', 'Browser geometry, assistive technology, and model/human judgment remain AVP concerns outside this static benchmark.'],
  };
}

function largeSurface(domain, groups) {
  const base = correctedEvidence(domain);
  const nodes = [];
  for (let group = 0; group < groups; group += 1) {
    const offset = nodes.length;
    nodes.push(
      { component: domain.template },
      { component: domain.organism, parent: offset },
      { component: domain.molecule, parent: offset + 1 },
      { component: domain.atom, parent: offset + 2, role: 'content' },
      { component: 'button', parent: offset + 1, variant: 'primary', state: 'default', role: 'button', action: 'primary', region: `row-${group}`, text: domain.actionLabel, slots: ['label'] },
    );
  }
  return { ...base, source: 'benchmark://large-surface', nodes };
}

async function stress(size, version) {
  const started = performance.now();
  const heapBefore = process.memoryUsage().heapUsed;
  let detected = 0;
  let falseAlarms = 0;
  let unexpectedResults = 0;
  for (let index = 0; index < size; index += 1) {
    const domain = DOMAINS[index % DOMAINS.length];
    const vulnerable = index % 2 === 1;
    const category = CATEGORIES[Math.floor(index / 2) % CATEGORIES.length];
    const evidence = vulnerable ? vulnerableEvidence(domain, category) : correctedEvidence(domain);
    const verdict = await verifyEvidence(contracts.get(domain.id), evidence);
    const failures = verdict.results.filter((result) => result.status === 'fail');
    if (vulnerable && verdict.outcome === 'fail' && failures.length === 1 && failures[0].criterionId === `design.${category}`) detected += 1;
    else if (!vulnerable && verdict.outcome !== 'pass') falseAlarms += 1;
    else if (vulnerable || failures.length) unexpectedResults += 1;
  }
  const domain = DOMAINS[0];
  const large = largeSurface(domain, 10_000);
  const scaleStarted = performance.now();
  const scaleFindings = inspectEvidence(contracts.get(domain.id), large);
  const scaleDurationMs = performance.now() - scaleStarted;
  const deterministic = JSON.stringify(inspectEvidence(contracts.get(domain.id), vulnerableEvidence(domain, 'composition')));
  const deterministicRuns = 100;
  let drift = 0;
  for (let index = 0; index < deterministicRuns; index += 1) if (JSON.stringify(inspectEvidence(contracts.get(domain.id), vulnerableEvidence(domain, 'composition'))) !== deterministic) drift += 1;
  const durationMs = performance.now() - started;
  const vulnerable = Math.floor(size / 2);
  return {
    schema: 1, benchmark: 'assay-design-multidomain-stress', version,
    corpus: { subjects: size, domains: DOMAINS.length, corrected: size - vulnerable, vulnerable, avpCriterionVerdicts: size * CATEGORIES.length },
    accuracy: { expectedFailures: vulnerable, detectedFailures: detected, missedFailures: vulnerable - detected, falseAlarms, unexpectedResults },
    determinism: { runs: deterministicRuns, drift },
    scale: { nodes: large.nodes.length, findings: scaleFindings.length, durationMs: round(scaleDurationMs), nodesPerSecond: round((large.nodes.length * 1_000) / Math.max(scaleDurationMs, 0.01)) },
    performance: { durationMs: round(durationMs), subjectsPerSecond: round((size * 1_000) / Math.max(durationMs, 0.01)), heapDeltaBytes: process.memoryUsage().heapUsed - heapBefore },
    passed: detected === vulnerable && !falseAlarms && !unexpectedResults && !drift && !scaleFindings.length,
    limitations: ['The corpus is deterministic and synthetic.', 'Timing is observational and is not a cross-machine pass threshold.', 'The stress test exercises Evidence IR plus AVP verdict aggregation, not Figma or browser rendering latency.'],
  };
}

function report(result) {
  if (result.benchmark.endsWith('calibration')) return `# Assay Design domain calibration\n\nEight UI domains exercise corrected controls and one isolated mutant for every AVP design criterion.\n\n| Measurement | Result |\n| --- | ---: |\n| Domains | ${result.corpus.domains} |\n| Corrected controls | ${result.corpus.correctedControls} |\n| Mutants detected | ${result.accuracy.detectedMutants}/${result.corpus.mutants} |\n| Missed mutants | ${result.accuracy.missedMutants} |\n| False alarms | ${result.accuracy.falseAlarms} |\n| Overall | ${result.passed ? 'PASS' : 'FAIL'} |\n\nDomains: ${result.cases.map((item) => item.domain).join(', ')}.\n\n## Limits\n\n${result.limitations.map((item) => `- ${item}`).join('\n')}\n`;
  return `# Assay Design multidomain stress: ${result.corpus.subjects.toLocaleString('en-US')} subjects\n\n| Measurement | Result |\n| --- | ---: |\n| AVP criterion verdicts | ${result.corpus.avpCriterionVerdicts.toLocaleString('en-US')} |\n| Failures detected | ${result.accuracy.detectedFailures}/${result.accuracy.expectedFailures} |\n| False alarms | ${result.accuracy.falseAlarms} |\n| Determinism drift | ${result.determinism.drift}/${result.determinism.runs} |\n| Large surface | ${result.scale.nodes.toLocaleString('en-US')} nodes in ${result.scale.durationMs} ms |\n| Subjects per second | ${result.performance.subjectsPerSecond.toLocaleString('en-US')} |\n| Overall | ${result.passed ? 'PASS' : 'FAIL'} |\n\n## Limits\n\n${result.limitations.map((item) => `- ${item}`).join('\n')}\n`;
}

async function save(result, suffix) {
  const directory = resolve(import.meta.dirname, 'results', `v${result.version}-${suffix}`);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'summary.json'), `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(resolve(directory, 'REPORT.md'), report(result));
  console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.benchmark} ${suffix}`);
  if (!result.passed) process.exitCode = 1;
}

const version = JSON.parse(await readFile(resolve(import.meta.dirname, '..', 'package.json'))).version;
await save(await calibrate(version), 'domains');
for (const size of corpora(process.argv.slice(2))) await save(await stress(size, version), `stress-${size}`);
