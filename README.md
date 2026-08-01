# Assay Design

Assay Design turns a design system into a versioned, declarative contract that agents and tools can verify. It depends directly on [`avp-assay`](https://www.npmjs.com/package/avp-assay): every check returns a normal AVP verdict, so design conformance composes with the same acceptance pipeline as behavior.

The three design surfaces have deliberately different jobs:

| Surface | Owns | Does not own |
| --- | --- | --- |
| `.design/` in Git | vocabulary, tokens, composition, policies, coverage | visual editing |
| Figma plugin | design exploration and evidence projection | canonical truth |
| Storybook addon | executable component rendering and feedback | a separate rule engine |

## Start

```sh
npm install -D https://github.com/lucasrgt/assay-design/releases/download/v0.2.0/assay-design-0.2.0.tgz
npx assay-design init
npx assay-design doctor
npx assay-design context
npx assay-design check --evidence evidence.json
```

The release asset is an ordinary `npm pack` tarball and is the current canonical distribution. The package name remains `assay-design`; registry publication can use the same artifact when npm credentials are configured.

`contract.toml` makes Atomic Design executable rather than decorative. Components declare `atom`, `molecule`, `organism`, or `template` plus their allowed `parts`; atoms cannot compose components, lower tiers cannot contain higher tiers, cycles and unknown parts are rejected, and every surface can bind a declared template. Pages live as `surface` contracts because they are product instances, not reusable design-system components. Same-tier composition is allowed only when explicitly declared, which supports practical nested organisms without abandoning the hierarchy.

The DOM collector records the nearest design-component parent in the common Evidence IR. AVP therefore verifies the rendered hierarchy as well as variants, states, roles, slots, semantic icon intents, action/text/heading policies, DTCG tokens, and required surface coverage. Frameworks that do not expose a DOM can emit the same `parent` indices directly.

Rendered elements expose a language-neutral evidence seam. Existing `data-ui` conventions are accepted as an alias:

```html
<main data-ds-region="hero">
  <button data-ds="button" data-variant="primary" data-action="primary">
    <span data-ds-slot="label">Create project</span>
  </button>
</main>
```

```ts
import { collectDocument, loadContract, verifyEvidence } from 'assay-design';

const verdict = await verifyEvidence(
  await loadContract(),
  collectDocument(document, 'dashboard', { states: ['default'], themes: ['light'] }),
);
```

## Storybook

Add `assay-design/storybook` to `addons`. Supply the compiled contract and surface through story parameters; the Design panel renders the AVP result.

```ts
export const Default = {
  parameters: { designHarness: { contract, surface: 'dashboard', coverage: { states: ['default'] } } },
};
```

The addon is optional: Assay Design does not install or replace Storybook.

## Figma

Build the package, then import [`figma/manifest.json`](./figma/manifest.json) as a development plugin. Paste the output of `assay-design export`; the plugin scans local components and variables, emits the common Evidence IR, and asks the same AVP core for a verdict. It never writes over the Git contract.

## MCP and ecosystem

`assay-design mcp` serves `design_context`, `design_export`, and `design_verify` over stdio. The compact context also emits Agent First Graph URIs. Optional `[links]` relations can point to RTW exemplars (`exemplifies`) or WTW decisions (`establishes`) without taking runtime dependencies on RTW, WTW, NYA, NWC, CSM, or Taskfleet.

## Mini harness

`npm run check` enforces typecheck, lint, tests, package entrypoints, runtime source ≤500 LOC, every file ≤500 LOC, ≥95% line/statement/function coverage, and ≥90% branch coverage. CI runs it on Linux, Windows, and macOS with Node 24.

## Benchmarks

`npm run benchmark` calibrates the five AVP design criteria across analytics, commerce, healthcare, fintech, government, media, education, and travel, then stresses 1,024 and 10,000 mixed corrected/vulnerable subjects plus a 50,000-node surface. The committed v0.2.0 run detected all 40 isolated domain mutants with zero misses and zero false alarms; the 10,000-subject run preserved all 50,000 AVP criterion verdicts with zero drift. See the [protocol and reports](./benchmarks/README.md).

These measurements prove deterministic contract conformance and engine integrity. They deliberately do not claim that static rules can measure subjective beauty, user research, browser geometry, or assistive-technology behavior; those remain separate AVP probes.
