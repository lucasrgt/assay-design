import type { Meta, StoryObj } from '@storybook/react-vite';
import { parseContract } from '../src/index.js';

export const canonicalStories = {
  button: [
    { id: 'assay-design-canonical-components--button-dom', label: 'DOM', platform: 'web' },
    { id: 'assay-design-canonical-components--button-native-web', label: 'RN Web', platform: 'react-native-web' },
  ],
  text: 'assay-design-canonical-components--text',
  badge: 'assay-design-canonical-components--badge',
  metric: 'assay-design-canonical-components--metric',
  'search-field': 'assay-design-canonical-components--search-field',
  card: 'assay-design-canonical-components--card',
  navigation: 'assay-design-canonical-components--navigation',
  'dashboard-grid': 'assay-design-canonical-components--dashboard-grid',
  'application-shell': 'assay-design-canonical-components--application-shell',
};

export const canonicalControls = {
  button: {
    variants: { primary: { variant: 'primary' }, secondary: { variant: 'secondary' } },
    states: { default: { state: 'default' }, disabled: { state: 'disabled' } },
    widths: { bounded: { width: 'bounded' }, full: { width: 'full' } },
  },
  badge: { variants: { neutral: { variant: 'neutral' }, positive: { variant: 'positive' } } },
};

export const showcaseContract = {
  ...parseContract(`schema = 1
name = "assay-showcase"

[groups]
shared_label = "Shared"

[[groups.foundations]]
label = "Brand"
include = ["color.*"]

[[groups.composition]]
label = "Dashboard"
include = ["dashboard-*", "application-shell"]

[policies]
max_primary_actions_per_region = 1
button_label_pattern = "^[A-Z].+"
max_heading_jump = 1

[[components]]
name = "button"
tier = "atom"
variants = ["primary", "secondary"]
states = ["default", "hover", "active", "focus", "focus-visible", "disabled"]
roles = ["button"]
required_slots = ["label"]
inline_sizing = "bounded"
allow_full_width = true

[[components]]
name = "text"
tier = "atom"
roles = ["heading", "body", "label"]

[[components]]
name = "badge"
tier = "atom"
variants = ["neutral", "positive"]

[[components]]
name = "metric"
tier = "atom"
roles = ["status"]

[[components]]
name = "search-field"
tier = "molecule"
parts = ["text", "button"]
required_slots = ["field"]

[[components]]
name = "card"
tier = "molecule"
parts = ["text", "badge", "metric", "button"]
required_slots = ["content"]

[[components]]
name = "navigation"
tier = "organism"
parts = ["text", "button"]

[[components]]
name = "dashboard-grid"
tier = "organism"
parts = ["search-field", "card", "text"]

[[components]]
name = "application-shell"
tier = "template"
parts = ["navigation", "dashboard-grid"]

[[surfaces]]
name = "design-overview"
template = "application-shell"
required_components = ["navigation", "dashboard-grid", "search-field", "card", "text", "badge", "metric", "button"]
states = ["default"]
themes = ["dark"]
viewports = ["desktop"]
locales = ["en"]

[[surfaces]]
name = "canonical-component"
`),
  tokens: {
    'color.canvas': '#08110f',
    'color.surface': '#101c18',
    'color.action.primary': '#b8f34a',
    'color.content.primary': '#000000',
    'space.sm': '8px',
    'space.md': '16px',
    'radius.md': '14px',
    'fontSize.body': '16px',
    'fontSize.title': '1.5em',
    'fontSize.display': '2em',
  },
};

export function ContractStory({ inconsistent = false }: { inconsistent?: boolean }) {
  return (
    <main className="product-shell" data-ds="application-shell">
      <nav className="product-nav" data-ds="navigation">
        <div className="brand"><i />ASSAY DESIGN</div>
        <span data-ds="text" data-role="body">Design operations</span>
        <button data-ds="button" data-variant="secondary" data-state="default" data-role="button"><span data-ds-slot="label">View contract</span></button>
      </nav>

      <section className="product-body" data-ds="dashboard-grid">
        <header className="product-heading">
          <div>
            <span className="eyebrow">RENDERED STORY / LIVE EVIDENCE</span>
            <h1 data-ds="text" data-role="heading">Component operations</h1>
            {inconsistent ? <h3 data-ds="text" data-role="heading">An intentionally broken implementation</h3> : <p data-ds="text" data-role="body">This canvas is the subject. The Design Contract panel is the report.</p>}
          </div>
          <div className="search-field" data-ds="search-field">
            <span data-ds="text" data-role="label">Find component</span>
            <input data-ds-slot="field" placeholder="Button, Card, Navigation…" />
            <button data-ds="button" data-variant="secondary" data-state="default" data-role="button"><span data-ds-slot="label">Filter</span></button>
          </div>
        </header>

        {inconsistent ? <aside className="rogue-banner" data-ds="promo-banner">This component is outside the declared vocabulary.</aside> : null}

        <div className="component-grid">
          <article className="component-card" data-ds="card">
            <div {...(!inconsistent ? { 'data-ds-slot': 'content' } : {})}>
              <div className="card-top">
                <span data-ds="badge" data-variant="positive">Stable</span>
                <span data-ds="text" data-role="label">ATOM</span>
              </div>
              <h2 data-ds="text" data-role="heading">Button</h2>
              <p data-ds="text" data-role="body">Primary interaction used across product surfaces.</p>
              <div className="metric" data-ds="metric" data-role="status"><strong>12</strong><span>declared states</span></div>
              <button
                className={inconsistent ? 'primary rogue' : 'primary'}
                data-ds="button"
                data-variant={inconsistent ? 'danger' : 'primary'}
                data-state="default"
                data-role="button"
                data-action="primary"
                data-ds-width="full"
                data-ds-token={inconsistent ? 'space.rogue' : 'color.action.primary'}
              >
                <span data-ds-slot="label">{inconsistent ? 'break contract' : 'Inspect component'}</span>
                {inconsistent ? <span className="nested-metric" data-ds="metric" data-role="status">illegal child</span> : null}
              </button>
            </div>
          </article>

          <article className="component-card" data-ds="card">
            <div data-ds-slot="content">
              <div className="card-top">
                <span data-ds="badge" data-variant="neutral">Observed</span>
                <span data-ds="text" data-role="label">MOLECULE</span>
              </div>
              <h2 data-ds="text" data-role="heading">Search field</h2>
              <p data-ds="text" data-role="body">Composes label, field slot and an optional action.</p>
              <div className="metric" data-ds="metric" data-role="status"><strong>4</strong><span>surface usages</span></div>
              {inconsistent ? <button className="secondary" data-ds="button" data-variant="secondary" data-state="default" data-role="button" data-action="primary"><span data-ds-slot="label">Second primary action</span></button> : null}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

const meta = {
  title: 'Assay Design/Contract Workbench',
  component: ContractStory,
  excludeStories: ['canonicalStories', 'showcaseContract', 'ContractStory'],
  parameters: {
    designHarness: {
      contract: showcaseContract,
      surface: 'design-overview',
      stories: canonicalStories,
      controls: canonicalControls,
      coverage: { states: ['default'], themes: ['dark'], viewports: ['desktop'], locales: ['en'] },
    },
  },
} satisfies Meta<typeof ContractStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Conformant: Story = {};
export const Inconsistent: Story = {
  args: { inconsistent: true },
  parameters: { designHarness: { contract: showcaseContract, surface: 'design-overview', stories: canonicalStories, controls: canonicalControls, coverage: { states: ['default'], themes: [], viewports: [], locales: ['en'] } } },
};
