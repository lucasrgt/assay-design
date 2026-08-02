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
npm install -D https://github.com/lucasrgt/assay-design/releases/download/v0.3.0/assay-design-0.3.0.tgz
npx assay-design init
npx assay-design doctor
npx assay-design context
npx assay-design recall --task "add primary button to toolbar"
npx assay-design check --evidence evidence.json
```

The release asset is an ordinary `npm pack` tarball and is the current canonical distribution. The package name remains `assay-design`; registry publication can use the same artifact when npm credentials are configured.

`contract.toml` makes Atomic Design executable rather than decorative. Components declare `atom`, `molecule`, `organism`, or `template` plus their allowed `parts`; atoms cannot compose components, lower tiers cannot contain higher tiers, cycles and unknown parts are rejected, and every surface can bind a declared template. Pages live as `surface` contracts because they are product instances, not reusable design-system components. Same-tier composition is allowed only when explicitly declared, which supports practical nested organisms without abandoning the hierarchy.

## Values, not just names

Vocabulary conformance alone cannot detect divergence, because the names are the one thing every screen and every app copies correctly. Two products both declare `color.primary` and `space.md` and still drift, and a stylesheet whose token references silently resolve to nothing still passes a name-level check. Assay Design therefore loads DTCG **values**, not only token paths, and judges the value that actually lands on screen.

Style evidence is a platform-neutral IR. `collectStylesheet` is the web adapter: it resolves the whole CSS cascade, reports the effective value of each declaration, and records references that bind to nothing. Frameworks without CSS emit the same `StyleDeclaration` shape directly.

```ts
import { collectStylesheet, inspectStyles, loadContract } from 'assay-design';

const findings = inspectStyles(await loadContract(), collectStylesheet({
  'tokens.css': tokensCss,
  'components.css': componentsCss,
}));
```

Two criteria carry this layer. `design.tokens` fails when a reference resolves to no value in the design language. `design.scale` fails when an effective value is off the declared scale for its dimension. A scale governs a set of properties, defaulted sensibly and overridable in the contract:

```toml
[scales]
space = ["padding", "margin", "gap", "inset", "top", "right", "bottom", "left"]
radius = ["border-radius"]
fontSize = ["font-size"]
```

## Promote into the language

Systematic escapes are de-facto tokens. `assay-design promote` writes them into the DTCG token file so the next audit treats them as legal scale values.

```sh
npx assay-design promote --styles ui.css --source src/App.tsx
npx assay-design promote --styles ui.css --dry-run
```

Entries land under `<group>.promoted.<slug>` (for example `space.promoted.13px`). Existing paths are left untouched.

## Fleet language

Design language belongs to the organization. An app contract declares `extends` to inherit a shared language and may only add local surfaces, components, and token files on top.

```toml
# apps/traveler/.design/contract.toml
schema = 1
name = "traveler"
extends = ["../../../packages/design-language/contract.toml"]
```

`assay-design fleet` audits multiple apps against that one language and ranks discipline by finding density. Systematic escapes shared across apps are the strongest promotion candidates.

```sh
npx assay-design fleet --contract packages/design-language/contract.toml \
  --member traveler=apps/traveler/src/Card.tsx \
  --member host=apps/host/src/Card.tsx
```

## Recall before edit

`assay-design recall` is the agent-facing brief before writing UI — the design analogue of `nya recall` / `rtw guide`. It is deterministic: no model, just the contract plus an optional population census.

```sh
npx assay-design recall --task "card padding on dashboard" --path src/Card.tsx --styles ui.css
```

The brief returns the relevant components and surfaces, the legal scale values, policies, systematic escapes that should be promoted rather than repeated, and a short rule list the agent must obey. MCP exposes the same operation as `design_recall`.

## Population audit

`assay-design audit` is the mid-project and fleet tool. It does not only ask whether one declaration is legal; it asks whether the population is coherent.

```sh
npx assay-design audit --styles tokens.css --styles ui.css --source src/App.tsx
```

The report has two layers:

| Layer | Meaning | Gate |
| --- | --- | --- |
| Census `systematic` | The same off-scale value repeats enough to be a de-facto token | Promote into `.design/` — advisory in the census |
| Census `oneOff` | A rare escape from the scale | Fails `design.scale` |
| Coherence findings | The same component family uses multiple values for one property | Fails `design.coherence` |

`--source` accepts TSX/JS/Astro text and extracts Tailwind arbitrary utilities plus React Native style literals into the same `StyleDeclaration` IR. CSS continues to enter through `--styles`.

This is how Assay Design serves greenfield, mid-project recovery, and new features without pretending that vocabulary conformance alone prevents visual drift. AVP therefore verifies the rendered hierarchy as well as variants, states, roles, slots, semantic icon intents, action/text/heading policies, token binding, value scales, and required surface coverage. Frameworks that do not expose a DOM can emit the same `parent` indices directly.

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

`assay-design mcp` serves `design_context`, `design_export`, `design_verify`, `design_recall`, and `design_fleet` over stdio. The compact context also emits Agent First Graph URIs. Optional `[links]` relations can point to RTW exemplars (`exemplifies`) or WTW decisions (`establishes`) without taking runtime dependencies on RTW, WTW, NYA, NWC, CSM, or Taskfleet.

## Mini harness

`npm run check` enforces typecheck, lint, tests, package entrypoints, tokei production budget (≤1,100 code lines total and ≤500 per file), ≥95% line/statement/function coverage, and ≥90% branch coverage. CI runs it on Linux, Windows, and macOS with Node 24.

## Benchmarks

`npm run benchmark` calibrates the eight AVP design criteria across analytics, commerce, healthcare, fintech, government, media, education, and travel, then stresses 1,024 and 10,000 mixed corrected/vulnerable subjects plus a 50,000-node surface. See the [protocol and reports](./benchmarks/README.md).

These measurements prove deterministic contract conformance and engine integrity. They deliberately do not claim that static rules can measure subjective beauty, user research, browser geometry, or assistive-technology behavior; those remain separate AVP probes.
