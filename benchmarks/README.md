# Benchmarks

Assay Design publishes two complementary deterministic measurements.

| Evidence | Question |
| --- | --- |
| Domain calibration | Do the five design criteria accept corrected controls and reject isolated violations across unrelated UI domains? |
| Multidomain stress | Does Evidence IR → AVP preserve exact, deterministic verdicts at 1,024 and 10,000 subjects and on a 50,000-node surface? |

The catalog covers analytics, commerce, healthcare, fintech, government,
media, education, and travel. Each domain has a different Atomic Design
vocabulary but the same five measurable conformance classes: components,
properties, composition, semantics, and coverage.

```sh
npm ci
npm run benchmark
```

Results are written under `benchmarks/results/`. They measure deterministic
contract conformance, not subjective beauty, usability research, browser
geometry, accessibility technology, or agent-generation quality.
