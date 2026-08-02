import type { Meta, StoryObj } from '@storybook/react-vite';
import { parseContract } from '../src/index.js';

const contract = {
  ...parseContract(`schema = 1
name = "assay-showcase"

[policies]
max_primary_actions_per_region = 1
button_label_pattern = "^[A-Z].+"

[[components]]
name = "button"
tier = "atom"
variants = ["primary", "secondary"]
states = ["default", "disabled"]
roles = ["button"]
required_slots = ["label"]

[[components]]
name = "metric"
tier = "atom"
roles = ["status"]

[[components]]
name = "card"
tier = "molecule"
parts = ["button", "metric"]
required_slots = ["content"]

[[components]]
name = "dashboard-grid"
tier = "organism"
parts = ["card"]

[[surfaces]]
name = "design-overview"
required_components = ["dashboard-grid", "card", "metric", "button"]
states = ["default"]
themes = ["dark"]
viewports = ["desktop"]
locales = ["en"]
`),
  tokens: {
    'color.canvas': '#08110f',
    'color.surface': '#101c18',
    'color.action.primary': '#b8f34a',
    'space.sm': '8px',
    'space.md': '16px',
    'radius.md': '14px',
    'fontSize.body': '16px',
  },
};

function Showcase({ inconsistent = false }: { inconsistent?: boolean }) {
  return (
    <main className="showcase-shell">
      <header className="showcase-header">
        <div>
          <span className="eyebrow">ASSAY DESIGN / LIVE CONTRACT</span>
          <h1>Consistency is a build artifact.</h1>
          <p>Atomic structure, semantic tokens and fleet rules evaluated on the rendered story.</p>
        </div>
        <div className="contract-state"><span />contract.toml · active</div>
      </header>

      <section className="dashboard-grid" data-ds="dashboard-grid">
        <article className="metric-card" data-ds="card">
          <div data-ds-slot="content">
            <span className="card-label">COMPONENT COVERAGE</span>
            <div className="metric-row" data-ds="metric" data-role="status">
              <strong>24/24</strong><span>atoms mapped</span>
            </div>
            <div className="meter"><i style={{ width: '100%' }} /></div>
          </div>
        </article>

        <article className="metric-card" data-ds="card">
          <div data-ds-slot="content">
            <span className="card-label">FLEET COHERENCE</span>
            <div className="metric-row" data-ds="metric" data-role="status">
              <strong>{inconsistent ? '3' : '0'}</strong><span>active drifts</span>
            </div>
            <div className="fleet-dots"><i /><i /><i /><i className={inconsistent ? 'warn' : ''} /></div>
          </div>
        </article>

        <article className="contract-card" data-ds="card">
          <div data-ds-slot="content">
            <div className="contract-heading">
              <div><span className="card-label">ATOMIC CONTRACT</span><h2>Dashboard grid</h2></div>
              <span className="tier">ORGANISM</span>
            </div>
            <div className="atomic-tree">
              <div className="tree-node organism"><b>dashboard-grid</b><small>organism</small></div>
              <div className="tree-branch">
                <div className="tree-node molecule"><b>card</b><small>molecule</small></div>
                <div className="tree-leaves">
                  <div className="tree-node atom"><b>metric</b><small>atom</small></div>
                  <div className="tree-node atom"><b>button</b><small>atom</small></div>
                </div>
              </div>
            </div>
            <button
              className={inconsistent ? 'action inconsistent' : 'action'}
              data-ds="button"
              data-variant={inconsistent ? 'danger' : 'primary'}
              data-state="default"
              data-role="button"
              data-action="primary"
              data-ds-token={inconsistent ? 'space.rogue' : 'color.action.primary'}
            >
              <span data-ds-slot="label">{inconsistent ? 'break contract' : 'Inspect verdict'}</span>
            </button>
          </div>
        </article>
      </section>

      <footer><span>8 deterministic criteria</span><span>AVP-backed verdict</span><span>Storybook projection</span></footer>
    </main>
  );
}

const meta = {
  title: 'Assay Design/Contract Overview',
  component: Showcase,
  parameters: {
    designHarness: {
      contract,
      surface: 'design-overview',
      coverage: { states: ['default'], themes: ['dark'], viewports: ['desktop'], locales: ['en'] },
    },
  },
} satisfies Meta<typeof Showcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Conformant: Story = {};
export const Inconsistent: Story = { args: { inconsistent: true } };
