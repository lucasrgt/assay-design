# Assay Design

Assay Design is a cross-framework linter for design systems. It uses a versioned, declarative contract to audit Atomic Design structure and consistency across components, screens, apps, and whole product fleets. It does not generate UI code. It depends directly on [`avp-assay`](https://www.npmjs.com/package/avp-assay): every check returns a normal AVP verdict, so design conformance composes with the same acceptance pipeline as behavior.

The three design surfaces have deliberately different jobs:

| Surface | Owns | Does not own |
| --- | --- | --- |
| `.design/` in Git | vocabulary, tokens, composition, policies, coverage | visual editing |
| Figma plugin | design exploration and evidence projection | canonical truth |
| Storybook addon | executable component rendering and feedback | a separate rule engine |

## Start

```sh
npm install -D https://github.com/lucasrgt/assay-design/releases/download/v0.5.0/assay-design-0.5.0.tgz
npx assay-design init
npx assay-design doctor
npx assay-design context
npx assay-design recall --task "add primary button to toolbar"
npx assay-design check --evidence evidence.json
```

The release asset is an ordinary `npm pack` tarball and is the current canonical distribution. The package name remains `assay-design`; registry publication can use the same artifact when npm credentials are configured.

`contract.toml` makes Atomic Design executable rather than decorative. Components declare `atom`, `molecule`, `organism`, or `template` plus their allowed `parts`; atoms cannot compose components, lower tiers cannot contain higher tiers, cycles and unknown parts are rejected, and every surface can bind a declared template. Pages live as `surface` contracts because they are product instances, not reusable design-system components. Same-tier composition is allowed only when explicitly declared, which supports practical nested organisms without abandoning the hierarchy.

Atomic tier and product ownership are separate axes. A fleet can keep shared foundations and components beside product-specific ones without inventing new Atomic tiers. Optional contract groups organize both Foundations and Composition in the Storybook projection; the first matching rule owns an item and everything unmatched remains in the shared folder.

```toml
[groups]
shared_label = "Shared"

[[groups.foundations]]
label = "Storefront"
include = ["color.product.storefront.*", "motion.storefront.*"]

[[groups.composition]]
label = "Storefront"
include = ["storefront-*"]

[[groups.composition]]
label = "Operations"
include = ["operations-*", "admin-*"]
```

Patterns accept exact paths, path prefixes, and `*` globs. A foundation category can therefore be split across multiple ownership folders while keeping one canonical DTCG document. Inherited organization-level groups merge with app-local groups, so the same organization is visible consistently across a multi-app fleet.

## Values, not just names

Vocabulary conformance alone cannot detect divergence, because the names are the one thing every screen and every app copies correctly. Two products both declare `color.primary` and `space.md` and still drift, and a stylesheet whose token references silently resolve to nothing still passes a name-level check. Assay Design therefore loads DTCG **values**, not only token paths, and judges declared or observed values instead of trusting vocabulary alone.

Style adapters emit small, lossy observations for linting. They are not a canonical UI representation and are never codegen input. `collectStylesheet` parses CSS declarations, resolves visible custom-property references, and records references that bind to nothing. Browser adapters remain responsible for the real computed cascade.

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

Systematic escapes are candidates for the design language, not proof that they are good decisions. `assay-design promote` therefore emits a proposal by default. Applying its mechanical DTCG patch requires the explicit `--apply` flag and should follow semantic review.

```sh
npx assay-design promote --styles ui.css --source src/App.tsx
npx assay-design promote --styles ui.css --tokens .design/tokens.tokens.json --apply
```

Entries land under `<group>.promoted.<slug>` (for example `space.promoted.13px`). Existing paths are left untouched.

## Fleet language

Design language belongs to the organization. An app contract declares `extends` to inherit a shared language and may only add local surfaces, components, and tokens. Inherited definitions are sealed unless the base contract names a deliberate extension point.

```toml
# apps/traveler/.design/contract.toml
schema = 1
name = "traveler"
extends = ["../../../packages/design-language/contract.toml"]
```

```toml
# packages/design-language/contract.toml
[inheritance]
extension_points = ["token:color.brand", "surface:product-home"]
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

`--source` accepts files or directories, ignores tests/build outputs, and extracts named or arbitrary Tailwind utilities plus React Native style literals as lint observations. Raw color literals fail even when their numeric value happens to equal a token. CSS continues to enter through `--styles`; rendered DOM evidence additionally observes computed color, minimum height, padding, radius, shadow, and text metrics. Component `style_bindings` can therefore reject a rendered recipe whose geometry or elevation diverges even when it uses a canonical component. Every audit reports observation coverage; an empty scan or a fleet member without comparable component subjects fails closed instead of receiving a zero-drift score.

Findings use stable rule IDs such as `atomic/illegal-tier-nesting`, `tokens/unresolved-reference`, `tokens/off-scale-one-off`, `coherence/property-drift`, and `coverage/no-comparable-subjects`. Adapters only report observations; these rules and their severity belong to the harness core.

This is how Assay Design serves greenfield, mid-project recovery, and new features without pretending that vocabulary conformance alone prevents visual drift. AVP therefore verifies the rendered hierarchy as well as variants, states, roles, slots, semantic icon intents, action/text/heading policies, token binding, value scales, and required surface coverage. Frameworks that do not expose a DOM can emit the same `parent` indices directly.

Rendered elements expose a language-neutral evidence seam. Existing `data-ui` conventions are accepted as an alias:

```toml
[[components]]
name = "button"
tier = "atom"
inline_sizing = "bounded"
allow_full_width = true
```

```html
<main data-ds-region="hero">
  <button data-ds="button" data-variant="primary" data-action="primary">
    <span data-ds-slot="label">Create project</span>
  </button>
  <button data-ds="button" data-variant="primary" data-ds-width="full">
    <span data-ds-slot="label">Continue</span>
  </button>
</main>
```

`inline_sizing = "bounded"` makes container-filling width a detectable inconsistency. `data-ds-width="full"` is an explicit instance-level exception and only passes when `allow_full_width = true`. The collector compares the sizing strategy rather than raw pixels, so different labels or icons may legitimately change a bounded component's natural width.

```ts
import { collectDocument, loadContract, verifyEvidence } from 'assay-design';

const verdict = await verifyEvidence(
  await loadContract(),
  collectDocument(document, 'dashboard', { states: ['default'], themes: ['light'] }),
);
```

## Storybook

Install the optional `storybook-addon-pseudo-states` peer and add `assay-design/storybook` to `addons`. Supply the compiled contract and surface through story parameters; the full-page Design Contract tab renders the AVP result. An optional `stories` map connects reusable component names to canonical Storybook story IDs. A separate `pages` map connects product surfaces to their full-page stories, keeping pages outside the reusable Atomic tiers.

Compile or import contracts inside Storybook preview code through `assay-design/browser`. Pass imported DTCG documents as the second argument so the Atomic View can project typed foundations (color, typography, spacing, radii, shadows, motion, and other declared groups). `$type` is inherited from DTCG groups; the addon does not guess token categories from their names. The main entrypoint also exposes filesystem-backed CLI helpers and is intentionally Node-only.

```ts
import { parseContract } from 'assay-design/browser';
import contractSource from './contract.toml?raw';
import tokenDocument from './tokens.tokens.json';

const contract = parseContract(contractSource, [tokenDocument]);
```

```ts
export const Default = {
  parameters: {
    designHarness: {
      contract,
      surface: 'dashboard',
      stories: {
        button: [
          { id: 'design-system-atoms-button--dom', label: 'DOM', platform: 'web' },
          { id: 'design-system-atoms-button--rn-web', label: 'RN Web', platform: 'react-native-web' },
        ],
        card: 'design-system-molecules-card--default',
      },
      pages: {
        dashboard: 'product-pages-dashboard--default',
        profile: { id: 'product-pages-profile--default', label: 'Profile', path: 'Account/Settings' },
      },
      controls: {
        button: {
          variants: { primary: { variant: 'primary' }, secondary: { variant: 'secondary' } },
          states: { default: { disabled: false }, disabled: { disabled: true } },
          widths: { bounded: { width: 'bounded' }, full: { width: 'full' } },
        },
      },
      coverage: { states: ['default'] },
    },
  },
};
```

The addon never constructs a component from the contract: its inspector opens the mapped story, so the rendered subject is always the project's real implementation. A component may map to one story or to several named platform implementations; the inspector switches between them without changing the governing contract. Implementation entries may also carry their own `controls` when adapters expose different Storybook args. Page entries accept an optional `label` and slash-delimited or array `path`; the Atomic View renders those paths as collapsible folders while plain string mappings remain valid. Its search filters foundations, composition, components, pages, and page-folder ancestry. Explicit controls bind contract variants, data states, and width modes to real args. CSS interaction states named `hover`, `active`/`pressed`, `focus`, `focus-visible`, or `focus-within` are frozen through Storybook's pseudo-state preview integration without requiring an args mapping. Those badges become interactive, while parts and slots remain structural information. The addon is optional; Assay Design does not install or replace Storybook.

The repository includes a runnable showcase with conformant and intentionally inconsistent stories:

```sh
npm run storybook
```

## Figma

Build the package, then import [`figma/manifest.json`](./figma/manifest.json) as a development plugin. Paste the output of `assay-design export`; the plugin scans local components and variables, emits lint evidence, and asks the same AVP core for a verdict. It never writes over the Git contract.

## MCP and ecosystem

`assay-design mcp` serves `design_context`, `design_export`, `design_verify`, `design_audit`, `design_recall`, and `design_fleet` over stdio. The compact context also emits Agent First Graph URIs. Optional `[links]` relations can point to RTW exemplars (`exemplifies`) or WTW decisions (`establishes`) without taking runtime dependencies on RTW, WTW, NYA, NWC, CSM, or Taskfleet.

## Mini harness

`npm run check` enforces typecheck, lint, tests, package entrypoints, ≤500 tokei code lines per production file, ≥95% line/statement/function coverage, and ≥90% branch coverage. CI runs it on Linux, Windows, and macOS with Node 24.

## Benchmarks

`npm run benchmark` calibrates the eight AVP design criteria across analytics, commerce, healthcare, fintech, government, media, education, and travel, then stresses 1,024 and 10,000 mixed corrected/vulnerable subjects plus a 50,000-node surface. See the [protocol and reports](./benchmarks/README.md).

These measurements prove deterministic contract conformance and engine integrity. They deliberately do not claim that static rules can measure subjective beauty, user research, browser geometry, or assistive-technology behavior; those remain separate AVP probes.
