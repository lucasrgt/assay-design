import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { canonicalStories, showcaseContract } from './DesignHarness.stories.js';

function Canvas({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <main className={wide ? 'canonical-canvas canonical-canvas-wide' : 'canonical-canvas'}>{children}</main>;
}

const ButtonSubject = () => <button className="primary" data-ds="button" data-variant="primary" data-state="default" data-role="button"><span data-ds-slot="label">Inspect component</span></button>;
const TextSubject = () => <div><h2 data-ds="text" data-role="heading">Operational clarity</h2><p data-ds="text" data-role="body">Hierarchy and content roles stay consistent across every surface.</p></div>;
const BadgeSubject = () => <span className="canonical-badge" data-ds="badge" data-variant="positive">Stable</span>;
const MetricSubject = () => <div className="metric" data-ds="metric" data-role="status"><strong>98%</strong><span>contract coverage</span></div>;
const SearchSubject = () => <div className="search-field" data-ds="search-field"><span data-ds="text" data-role="label">Find component</span><input data-ds-slot="field" placeholder="Button, Card, Navigation…" /><button data-ds="button" data-variant="secondary" data-state="default" data-role="button"><span data-ds-slot="label">Filter</span></button></div>;
const CardSubject = () => <article className="component-card canonical-card" data-ds="card"><div data-ds-slot="content"><div className="card-top"><BadgeSubject /><span data-ds="text" data-role="label">MOLECULE</span></div><TextSubject /><MetricSubject /><ButtonSubject /></div></article>;
const NavigationSubject = () => <nav className="product-nav canonical-nav" data-ds="navigation"><div className="brand"><i />ASSAY DESIGN</div><span data-ds="text" data-role="body">Design operations</span><button data-ds="button" data-variant="secondary" data-state="default" data-role="button"><span data-ds-slot="label">View contract</span></button></nav>;
const GridSubject = () => <section className="canonical-grid" data-ds="dashboard-grid"><TextSubject /><SearchSubject /><CardSubject /></section>;

const meta = {
  title: 'Assay Design/Canonical Components',
  parameters: {
    layout: 'fullscreen',
    designHarness: {
      contract: showcaseContract,
      surface: 'canonical-component',
      stories: canonicalStories,
      coverage: { states: [], themes: [], viewports: [], locales: [] },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Button: Story = { render: () => <Canvas><ButtonSubject /></Canvas> };
export const Text: Story = { render: () => <Canvas><TextSubject /></Canvas> };
export const Badge: Story = { render: () => <Canvas><BadgeSubject /></Canvas> };
export const Metric: Story = { render: () => <Canvas><MetricSubject /></Canvas> };
export const SearchField: Story = { render: () => <Canvas><SearchSubject /></Canvas> };
export const Card: Story = { render: () => <Canvas><CardSubject /></Canvas> };
export const Navigation: Story = { render: () => <Canvas wide><NavigationSubject /></Canvas> };
export const DashboardGrid: Story = { render: () => <Canvas wide><GridSubject /></Canvas> };
export const ApplicationShell: Story = { render: () => <main className="product-shell" data-ds="application-shell"><NavigationSubject /><GridSubject /></main> };
