import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/public.ts',
      cli: 'src/cli.ts',
      mcp: 'src/mcp.ts',
      'storybook/preset': 'src/storybook/preset.ts',
      'storybook/manager': 'src/storybook/manager.ts',
      'storybook/preview': 'src/storybook/preview.ts',
    },
    format: ['esm'],
    dts: true,
    splitting: true,
    noExternal: ['@storybook/icons'],
    clean: true,
    sourcemap: true,
  },
  {
    entry: { figma: 'src/figma.ts' },
    format: ['iife'],
    platform: 'browser',
    outDir: 'dist',
    outExtension: () => ({ js: '.js' }),
    minify: true,
    clean: false,
  },
]);
