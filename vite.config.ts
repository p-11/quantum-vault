import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import path from 'path';
import manifest from './manifest.json';
import packageJson from './package.json';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { attempt } from './src/lib/attempt';
import type { BuildMetadata } from './src/lib/build-metadata';

const unknownBuildMetadataValue = 'unknown';
const unresolvedBuildMetadataValue = 'unresolved';

const getGitCommitSha = (): string => {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' });
  const commitSha = result.status === 0 ? result.stdout.trim() : '';
  return commitSha || unknownBuildMetadataValue;
};

const readJsonStringField = (filePath: string, field: string): string => {
  if (!existsSync(filePath)) {
    return unresolvedBuildMetadataValue;
  }

  const parseResult = attempt<unknown>(() =>
    JSON.parse(readFileSync(filePath, 'utf-8'))
  );
  if ('error' in parseResult) {
    return unresolvedBuildMetadataValue;
  }

  const parsedJson = parseResult.data;
  if (typeof parsedJson !== 'object' || parsedJson === null) {
    return unresolvedBuildMetadataValue;
  }

  const fieldValue = Reflect.get(parsedJson, field);
  return typeof fieldValue === 'string' && fieldValue
    ? fieldValue
    : unresolvedBuildMetadataValue;
};

export default defineConfig(({ command, isPreview, mode }) => {
  const isHmrRuntime = command === 'serve' && !isPreview;
  const libqcDependencySpec = packageJson.dependencies['@project-eleven/libqc'];
  const libqcPackageJsonPath = path.resolve(
    __dirname,
    'node_modules',
    '@project-eleven',
    'libqc',
    'package.json'
  );
  const buildMetadata: BuildMetadata = {
    commitSha: getGitCommitSha(),
    appVersion: packageJson.version,
    libqcDependencySpec,
    libqcResolvedVersion: readJsonStringField(libqcPackageJsonPath, 'version'),
    buildMode: mode,
    runtimeVariant: isHmrRuntime ? 'hmr' : 'extension'
  };

  const extensionRuntimePlugin = isHmrRuntime
    ? crx({ manifest })
    : viteStaticCopy({
        targets: [
          {
            src: 'manifest.json',
            dest: '.'
          },
          {
            src: 'icons/*',
            dest: 'icons'
          }
        ]
      });

  const fontAssetsPlugin = viteStaticCopy({
    targets: [
      {
        src: 'fonts/*',
        dest: 'assets/fonts'
      }
    ]
  });

  return {
    plugins: [
      react({
        babel: {
          plugins: ['babel-plugin-react-compiler']
        }
      }),
      extensionRuntimePlugin,
      fontAssetsPlugin,
      tailwindcss(),
      nodePolyfills()
    ],
    build: isHmrRuntime
      ? {
          outDir: 'build-hmr'
        }
      : {
          outDir: mode === 'production' ? 'dist' : 'build',
          minify: mode === 'production',
          sourcemap: mode === 'production' ? 'hidden' : false,
          target: mode === 'production' ? 'chrome110' : undefined,
          rollupOptions: {
            input: {
              main: './index.html'
            }
          }
        },
    server: isHmrRuntime
      ? {
          cors: true
        }
      : undefined,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    define: {
      __BUILD_METADATA__: JSON.stringify(buildMetadata)
    }
  };
});
