import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const avpPackage = require.resolve('avp-assay/package.json');
const avpEntry = resolve(dirname(avpPackage), JSON.parse(readFileSync(avpPackage, 'utf8')).module);
// Figma must embed the protocol runtime, not AVP's unrelated criterion catalog.
const avpCoreMatch = readFileSync(avpEntry, 'utf8').match(/export \{[^}]*\bAvpFail\b[^}]*\} from ['"](\.\/chunk-[^'"]+\.js)['"]/);
if (!avpCoreMatch) throw new Error('Could not locate the AVP protocol core entry');
const avpCore = resolve(dirname(avpEntry), avpCoreMatch[1]!);

export default defineConfig([
  {
    entry: {
      index: 'src/public.ts',
      browser: 'src/browser.ts',
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
    esbuildPlugins: [{
      name: 'avp-protocol-core-only',
      setup(build) {
        build.onResolve({ filter: /^avp-assay$/ }, () => ({ path: avpCore }));
      },
    }],
  },
]);
