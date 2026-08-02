import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';

function Stage({ label, children }: { label: string; children: ReactNode }) {
  return <main className="canonical-stage"><span className="eyebrow">{label}</span><div className="canonical-subject">{children}</div></main>;
}

const ButtonSubject = () => <button className="primary" data-ds="button" data-variant="primary" data-state="default" data-role="button"><span data-ds-slot="label">Inspect component</span></button>;
const TextSubject = () => <div><h2 data-ds="text" data-role="heading">Operational clarity</h2><p data-ds="text" data-role="body">Hierarchy and content roles stay consistent across every surface.</p></div>;
const BadgeSubject = () => <span className="canonical-badge" data-ds="badge" data-variant="positive">Stable</span>;
const MetricSubject = () => <div className="metric" data-ds="metric" data-role="status"><strong>98%</strong><span>contract coverage</span></div>;
const SearchSubject = () => <div className="search-field" data-ds="search-field"><span data-ds="text" data-role="label">Find component</span><input data-ds-slot="field" placeholder="Button, Card, Navigation…" /><button data-ds="button" data-variant="secondary" data-state="default" data-role="button"><span data-ds-slot="label">Filter</span></button></div>;
const CardSubject = () => <article className="component-card canonical-card" data-ds="card"><div data-ds-slot="content"><div className="card-top"><BadgeSubject /><span data-ds="text" data-role="label">MOLECULE</span></div><TextSubject /><MetricSubject /><ButtonSubject /></div></article>;
const NavigationSubject = () => <nav className="product-nav canonical-nav" data-ds="navigation"><div className="brand"><i />ASSAY DESIGN</div><span data-ds="text" data-role="body">Design operations</span><button data-ds="button" data-variant="secondary" data-state="default" data-role="button"><span data-ds-slot="label">View contract</span></button></nav>;
const GridSubject = () => <section className="canonical-grid" data-ds="dashboard-grid"><TextSubject /><SearchSubject /><CardSubject /></section>;

const meta = { title: 'Assay Design/Canonical Components', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Button: Story = { render: () => <Stage label="ATOM / BUTTON"><ButtonSubject /></Stage> };
export const Text: Story = { render: () => <Stage label="ATOM / TEXT"><TextSubject /></Stage> };
export const Badge: Story = { render: () => <Stage label="ATOM / BADGE"><BadgeSubject /></Stage> };
export const Metric: Story = { render: () => <Stage label="ATOM / METRIC"><MetricSubject /></Stage> };
export const SearchField: Story = { render: () => <Stage label="MOLECULE / SEARCH FIELD"><SearchSubject /></Stage> };
export const Card: Story = { render: () => <Stage label="MOLECULE / CARD"><CardSubject /></Stage> };
export const Navigation: Story = { render: () => <Stage label="ORGANISM / NAVIGATION"><NavigationSubject /></Stage> };
export const DashboardGrid: Story = { render: () => <Stage label="ORGANISM / DASHBOARD GRID"><GridSubject /></Stage> };
export const ApplicationShell: Story = { render: () => <main className="product-shell" data-ds="application-shell"><NavigationSubject /><GridSubject /></main> };
