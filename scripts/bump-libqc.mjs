import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LIBQC_PACKAGE = '@project-eleven/libqc';
const EXACT_SEMVER_REGEX =
  /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const fail = message => {
  console.error(message);
  process.exit(1);
};

const readPackageJson = () => {
  const packageJsonPath = resolve('package.json');
  return JSON.parse(readFileSync(packageJsonPath, 'utf8'));
};

const run = command =>
  execSync(command, {
    stdio: 'inherit',
    encoding: 'utf8'
  });

const runAndReadStdoutResult = ({ command, args }) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8'
  });

  const stdout = result.stdout?.trim() ?? '';

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    return {
      ok: false,
      stdout
    };
  }

  return {
    ok: true,
    stdout
  };
};

const assertExactSemver = version => {
  if (!EXACT_SEMVER_REGEX.test(version)) {
    fail(
      `Invalid libqc version '${version}'. Provide an exact semver like 0.0.18.`
    );
  }
};

const assertPublishedVersionExists = version => {
  const result = runAndReadStdoutResult({
    command: 'pnpm',
    args: ['view', `${LIBQC_PACKAGE}@${version}`, 'version']
  });

  if (!result.ok) {
    fail(
      `${LIBQC_PACKAGE}@${version} is not available from npm. Confirm the version is published and accessible.`
    );
  }

  const npmVersion = result.stdout;

  if (npmVersion !== version) {
    fail(
      `pnpm returned '${npmVersion}' for ${LIBQC_PACKAGE}@${version}. Expected exact match.`
    );
  }
};

const readDeclaredLibqcVersion = () => {
  const packageJson = readPackageJson();
  const declaredVersion = packageJson.dependencies?.[LIBQC_PACKAGE];

  if (typeof declaredVersion !== 'string' || declaredVersion.length === 0) {
    fail(`package.json is missing dependency ${LIBQC_PACKAGE}.`);
  }

  return declaredVersion;
};

const parseArgs = argv => {
  const args = argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filteredArgs = args.filter(arg => arg !== '--dry-run');

  if (filteredArgs.includes('--help') || filteredArgs.includes('-h')) {
    return {
      help: true,
      dryRun,
      libqcVersion: ''
    };
  }

  const versionFlagIndex = filteredArgs.indexOf('--libqc-version');
  const hasVersionFlag = versionFlagIndex !== -1;
  const positionalArgs = hasVersionFlag
    ? filteredArgs.filter(
        (_, index) =>
          index !== versionFlagIndex && index !== versionFlagIndex + 1
      )
    : filteredArgs;

  const flagValue = hasVersionFlag
    ? filteredArgs[versionFlagIndex + 1]
    : undefined;
  const positionalValue = positionalArgs[0];
  const libqcVersion = flagValue ?? positionalValue;

  if (typeof libqcVersion !== 'string' || libqcVersion.length === 0) {
    fail(
      'Missing libqc version. Use --libqc-version <x.y.z> or provide it as the first argument.'
    );
  }

  if (hasVersionFlag && positionalArgs.length > 0) {
    fail(
      'Do not mix positional arguments with --libqc-version. Use one form only.'
    );
  }

  if (!hasVersionFlag && positionalArgs.length > 1) {
    fail('Unexpected extra arguments. Use --help for usage.');
  }

  return {
    help: false,
    dryRun,
    libqcVersion
  };
};

const printHelp = () => {
  const usage = [
    'Usage:',
    '  node scripts/bump-libqc.mjs --libqc-version <x.y.z> [--dry-run]',
    '  node scripts/bump-libqc.mjs <x.y.z> [--dry-run]',
    '',
    'Examples:',
    '  node scripts/bump-libqc.mjs --libqc-version 0.0.18',
    '  node scripts/bump-libqc.mjs 0.0.18 --dry-run'
  ].join('\n');

  console.log(usage);
};

const main = () => {
  const { help, dryRun, libqcVersion } = parseArgs(process.argv);

  if (help) {
    printHelp();
    return;
  }

  assertExactSemver(libqcVersion);
  const currentVersion = readDeclaredLibqcVersion();

  if (currentVersion === libqcVersion) {
    console.log(
      `No change: ${LIBQC_PACKAGE} is already pinned to ${libqcVersion}.`
    );
    return;
  }

  assertPublishedVersionExists(libqcVersion);

  if (dryRun) {
    console.log(
      `Dry run: ${LIBQC_PACKAGE} would be bumped from ${currentVersion} to ${libqcVersion}.`
    );
    return;
  }

  run(`pnpm add ${LIBQC_PACKAGE}@${libqcVersion} --ignore-scripts`);
  run('pnpm install --frozen-lockfile --ignore-scripts');
  run('pnpm run verify:libqc-source');

  const resolvedVersion = readDeclaredLibqcVersion();
  if (resolvedVersion !== libqcVersion) {
    fail(
      `Bump validation failed: package.json resolved ${LIBQC_PACKAGE}=${resolvedVersion}, expected ${libqcVersion}.`
    );
  }

  console.log(
    `Successfully bumped ${LIBQC_PACKAGE} from ${currentVersion} to ${libqcVersion}.`
  );
};

main();
