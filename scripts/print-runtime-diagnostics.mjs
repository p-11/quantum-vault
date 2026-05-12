import { execSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

const envFilePaths = ['.env', '.env.local'].map(path => resolve(path));

const existingEnvFilePaths = envFilePaths.filter(path => existsSync(path));
const envVars =
  existingEnvFilePaths.length > 0
    ? (dotenv.config({
        override: true,
        path: existingEnvFilePaths,
        processEnv: {},
        quiet: true
      }).parsed ?? null)
    : null;

const redactUrlOrigin = value => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return '[unparseable]';
  }
};

const readJson = path => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};

const readCommand = command => {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
};

const nodeModulesMarker = '/node_modules/';

const redactResolvedPath = path => {
  const markerIndex = path.indexOf(nodeModulesMarker);
  if (markerIndex === -1) {
    return '<outside-node_modules>';
  }
  return path.slice(markerIndex + 1);
};

const packageJson = readJson(resolve('package.json')) ?? {};
const manifestJson = readJson(resolve('manifest.json')) ?? {};

const declaredLibqcVersion =
  packageJson.dependencies?.['@project-eleven/libqc'] ?? null;

const buildManifestPath = resolve('build/manifest.json');
const buildManifest = existsSync(buildManifestPath)
  ? readJson(buildManifestPath)
  : null;
const buildManifestVersion = buildManifest?.version ?? null;

const diagnostics = {
  generatedAt: new Date().toISOString(),
  git: {
    branch: readCommand('git rev-parse --abbrev-ref HEAD'),
    commit: readCommand('git rev-parse HEAD'),
    commitShort: readCommand('git rev-parse --short HEAD')
  },
  package: {
    version: packageJson.version ?? null,
    packageManager: packageJson.packageManager ?? null
  },
  extension: {
    manifestVersion: manifestJson.version ?? null,
    buildManifestVersion,
    hasBuildDirectory: existsSync(resolve('build'))
  },
  libqc: {
    declaredVersion: declaredLibqcVersion,
    installedVersion: null,
    resolvedPackagePath: null,
    resolution: null
  },
  runtime: {
    nodeVersion: process.version,
    platform: process.platform,
    pnpmVersion: readCommand('pnpm --version')
  },
  env: {
    sourceFiles:
      existingEnvFilePaths.length > 0
        ? existingEnvFilePaths.map(path => path.replace(`${process.cwd()}/`, ''))
        : ['(no env files found)'],
    urls: {
      VITE_ETHEREUM_RPC_URL: redactUrlOrigin(envVars?.['VITE_ETHEREUM_RPC_URL']),
      VITE_BITCOIN_API_URL: redactUrlOrigin(envVars?.['VITE_BITCOIN_API_URL']),
      VITE_ASSET_PRICES_URL: redactUrlOrigin(envVars?.['VITE_ASSET_PRICES_URL']),
      VITE_ETHEREUM_BUNDLER_RPC_URL: redactUrlOrigin(
        envVars?.['VITE_ETHEREUM_BUNDLER_RPC_URL']
      ),
      VITE_ETHEREUM_BUNDLER_API_KEY: envVars?.['VITE_ETHEREUM_BUNDLER_API_KEY']
        ? '[REDACTED]'
        : null
    }
  }
};

try {
  const resolvedPackageJsonPath = realpathSync(
    resolve('node_modules/@project-eleven/libqc/package.json')
  );
  const libqcPackageJson = readJson(resolvedPackageJsonPath) ?? {};

  diagnostics.libqc.installedVersion = libqcPackageJson.version ?? null;
  diagnostics.libqc.resolvedPackagePath = redactResolvedPath(
    resolvedPackageJsonPath
  );
  diagnostics.libqc.resolution = resolvedPackageJsonPath.includes(
    '/node_modules/.pnpm/'
  )
    ? 'pnpm-store'
    : 'linked-or-custom';
} catch {
  diagnostics.libqc.resolution = 'not-installed';
}

console.log(JSON.stringify(diagnostics, null, 2));
