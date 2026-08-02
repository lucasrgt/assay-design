import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../demo/**/*.stories.@(ts|tsx)'],
  addons: ['assay-design/storybook'],
  framework: { name: '@storybook/react-vite', options: {} },
  core: { allowedHosts: ['localhost', '127.0.0.1'] },
};

export default config;
