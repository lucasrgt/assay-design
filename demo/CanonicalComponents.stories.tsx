import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { Pressable, Text as NativeText, TextInput, View } from 'react-native-web';
import { canonicalControls, canonicalStories, implementationPlatforms, showcaseContract } from './DesignHarness.stories.js';

function Canvas({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <main className={wide ? 'canonical-canvas canonical-canvas-wide' : 'canonical-canvas'}>{children}</main>;
}

type ButtonArgs = { variant: 'primary' | 'secondary'; state: 'default' | 'disabled'; width: 'bounded' | 'full' };
type BadgeArgs = { variant: 'neutral' | 'positive' };
const ButtonSubject = ({ variant = 'primary', state = 'default', width = 'bounded' }: Partial<ButtonArgs> = {}) => <button className={variant} disabled={state === 'disabled'} data-ds="button" data-variant={variant} data-state={state} data-role="button" data-ds-width={width === 'full' ? 'full' : undefined}><span data-ds-slot="label">Inspect component</span></button>;
const NativeWebButtonSubject = ({ variant = 'primary', state = 'default', width = 'bounded' }: Partial<ButtonArgs> = {}) => <Pressable accessibilityRole="button" disabled={state === 'disabled'} dataSet={{ ds: 'button', variant, state, role: 'button', dsWidth: width === 'full' ? 'full' : undefined }} style={({ pressed }) => ({ width: width === 'full' ? '100%' : 320, maxWidth: '82vw', padding: 13, borderWidth: 1, borderStyle: 'solid', borderColor: variant === 'primary' ? '#b8f34a' : '#345648', borderRadius: 9, alignItems: 'center', backgroundColor: variant === 'primary' ? pressed ? '#a8df3f' : '#b8f34a' : pressed ? '#1b3027' : '#14251e', opacity: state === 'disabled' ? .46 : 1, transform: pressed ? 'translateY(1px)' : undefined })}><NativeText dataSet={{ dsSlot: 'label' }} style={{ color: variant === 'primary' ? '#142009' : '#dce9e3', fontSize: 16, fontWeight: 700 }}>Inspect component</NativeText></Pressable>;
const TextSubject = () => <div><h2 data-ds="text" data-role="heading">Operational clarity</h2><p data-ds="text" data-role="body">Hierarchy and content roles stay consistent across every surface.</p></div>;
const BadgeSubject = ({ variant = 'positive' }: Partial<BadgeArgs> = {}) => <span className={`canonical-badge canonical-badge-${variant}`} data-ds="badge" data-variant={variant}>{variant === 'positive' ? 'Stable' : 'Neutral'}</span>;
const MetricSubject = () => <div className="metric" data-ds="metric" data-role="status"><strong>98%</strong><span>contract coverage</span></div>;
const SearchSubject = () => <div className="search-field" data-ds="search-field"><span data-ds="text" data-role="label">Find component</span><input data-ds-slot="field" placeholder="Button, Card, Navigation…" /><button data-ds="button" data-variant="secondary" data-state="default" data-role="button"><span data-ds-slot="label">Filter</span></button></div>;
const CardSubject = () => <article className="component-card canonical-card" data-ds="card"><div data-ds-slot="content"><div className="card-top"><BadgeSubject /><span data-ds="text" data-role="label">MOLECULE</span></div><TextSubject /><MetricSubject /><ButtonSubject width="full" /></div></article>;
const NavigationSubject = () => <nav className="product-nav canonical-nav" data-ds="navigation"><div className="brand"><i />ASSAY DESIGN</div><span data-ds="text" data-role="body">Design operations</span><button data-ds="button" data-variant="secondary" data-state="default" data-role="button"><span data-ds-slot="label">View contract</span></button></nav>;
const GridSubject = () => <section className="canonical-grid" data-ds="dashboard-grid"><TextSubject /><SearchSubject /><CardSubject /></section>;
const nativeLayout = { width: '100%', gap: 12 } as const;
const NativeWebTextSubject = () => <View style={nativeLayout}><NativeText dataSet={{ ds: 'text', role: 'heading' }} style={{ color: '#dce9e3', fontSize: 24, fontWeight: 700 }}>Operational clarity</NativeText><NativeText dataSet={{ ds: 'text', role: 'body' }} style={{ color: '#9db3a9', fontSize: 16 }}>Hierarchy and content roles stay consistent across every surface.</NativeText></View>;
const NativeWebBadgeSubject = ({ variant = 'positive' }: Partial<BadgeArgs> = {}) => <NativeText dataSet={{ ds: 'badge', variant }} style={{ alignSelf: 'flex-start', padding: 7, color: '#142009', backgroundColor: '#b8f34a', borderRadius: 999, fontWeight: 700 }}>{variant === 'positive' ? 'Stable' : 'Neutral'}</NativeText>;
const NativeWebMetricSubject = () => <View dataSet={{ ds: 'metric', role: 'status' }} style={{ gap: 4 }}><NativeText style={{ color: '#dce9e3', fontSize: 30, fontWeight: 800 }}>98%</NativeText><NativeText style={{ color: '#9db3a9' }}>contract coverage</NativeText></View>;
const NativeWebSearchSubject = () => <View dataSet={{ ds: 'search-field' }} style={nativeLayout}><NativeText dataSet={{ ds: 'text', role: 'label' }} style={{ color: '#dce9e3' }}>Find component</NativeText><TextInput dataSet={{ dsSlot: 'field' }} placeholder="Button, Card, Navigation…" style={{ padding: 12, color: '#dce9e3', borderWidth: 1, borderColor: '#345648', borderRadius: 9 }} /><NativeWebButtonSubject variant="secondary" /></View>;
const NativeWebCardSubject = () => <View dataSet={{ ds: 'card' }} style={{ width: '100%', maxWidth: 540, padding: 20, borderWidth: 1, borderColor: '#345648', borderRadius: 14, backgroundColor: '#101c18' }}><View dataSet={{ dsSlot: 'content' }} style={nativeLayout}><NativeWebBadgeSubject /><NativeWebTextSubject /><NativeWebMetricSubject /><NativeWebButtonSubject width="full" /></View></View>;
const NativeWebNavigationSubject = () => <View dataSet={{ ds: 'navigation' }} style={{ ...nativeLayout, padding: 20, backgroundColor: '#101c18' }}><NativeText style={{ color: '#b8f34a', fontWeight: 800 }}>ASSAY DESIGN</NativeText><NativeWebTextSubject /><NativeWebButtonSubject variant="secondary" /></View>;
const NativeWebGridSubject = () => <View dataSet={{ ds: 'dashboard-grid' }} style={{ ...nativeLayout, padding: 20 }}><NativeWebTextSubject /><NativeWebSearchSubject /><NativeWebCardSubject /></View>;
const NativeWebShellSubject = () => <View dataSet={{ ds: 'application-shell' }} style={{ minHeight: '100vh', backgroundColor: '#08110f' }}><NativeWebNavigationSubject /><NativeWebGridSubject /></View>;

const meta = {
  title: 'Assay Design/Canonical Components',
  parameters: {
    layout: 'fullscreen',
    designHarness: {
      contract: showcaseContract,
      surface: 'canonical-component',
      stories: canonicalStories,
      implementationPlatforms,
      controls: canonicalControls,
      coverage: { states: [], themes: [], viewports: [], locales: [] },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const ButtonDOM: StoryObj<ButtonArgs> = { args: { variant: 'primary', state: 'default', width: 'bounded' }, render: (args) => <Canvas><ButtonSubject {...args} /></Canvas> };
export const ButtonNativeWeb: StoryObj<ButtonArgs> = { args: { variant: 'primary', state: 'default', width: 'bounded' }, render: (args) => <Canvas><NativeWebButtonSubject {...args} /></Canvas> };
export const TextDOM: Story = { render: () => <Canvas><TextSubject /></Canvas> };
export const TextNativeWeb: Story = { render: () => <Canvas><NativeWebTextSubject /></Canvas> };
export const BadgeDOM: StoryObj<BadgeArgs> = { args: { variant: 'positive' }, render: (args) => <Canvas><BadgeSubject {...args} /></Canvas> };
export const BadgeNativeWeb: StoryObj<BadgeArgs> = { args: { variant: 'positive' }, render: (args) => <Canvas><NativeWebBadgeSubject {...args} /></Canvas> };
export const MetricDOM: Story = { render: () => <Canvas><MetricSubject /></Canvas> };
export const MetricNativeWeb: Story = { render: () => <Canvas><NativeWebMetricSubject /></Canvas> };
export const SearchFieldDOM: Story = { render: () => <Canvas><SearchSubject /></Canvas> };
export const SearchFieldNativeWeb: Story = { render: () => <Canvas><NativeWebSearchSubject /></Canvas> };
export const CardDOM: Story = { render: () => <Canvas><CardSubject /></Canvas> };
export const CardNativeWeb: Story = { render: () => <Canvas><NativeWebCardSubject /></Canvas> };
export const NavigationDOM: Story = { render: () => <Canvas wide><NavigationSubject /></Canvas> };
export const NavigationNativeWeb: Story = { render: () => <Canvas wide><NativeWebNavigationSubject /></Canvas> };
export const DashboardGridDOM: Story = { render: () => <Canvas wide><GridSubject /></Canvas> };
export const DashboardGridNativeWeb: Story = { render: () => <Canvas wide><NativeWebGridSubject /></Canvas> };
export const ApplicationShellDOM: Story = { render: () => <main className="product-shell" data-ds="application-shell"><NavigationSubject /><GridSubject /></main> };
export const ApplicationShellNativeWeb: Story = { render: () => <NativeWebShellSubject /> };
