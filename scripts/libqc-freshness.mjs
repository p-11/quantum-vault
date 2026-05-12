import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const LIBQC_PACKAGE = '@project-eleven/libqc';

const fail = message => {
  console.error(message);
  process.exit(1);
};

const parseArgs = argv => {
  const args = argv.slice(2);

  return {
    requireLatest: args.includes('--require-latest'),
    allowStale: args.includes('--allow-stale'),
    printLatest: args.includes('--print-latest')
  };
};

const readDeclaredVersion = () => {
  const packageJsonPath = resolve('package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const declaredVersion = packageJson.dependencies?.[LIBQC_PACKAGE];

  if (typeof declaredVersion !== 'string' || declaredVersion.length === 0) {
    fail(`package.json is missing dependency ${LIBQC_PACKAGE}.`);
  }

  return declaredVersion;
};

const readLatestVersion = () => {
  const result = spawnSync('pnpm', ['view', LIBQC_PACKAGE, 'version'], {
    encoding: 'utf8'
  });

  const stdout = result.stdout?.trim() ?? '';
  const stderr = result.stderr?.trim() ?? '';

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 || stdout.length === 0) {
    fail(
      `Unable to read latest ${LIBQC_PACKAGE} version from registry. stdout='${stdout}' stderr='${stderr}'`
    );
  }

  return stdout;
};

const writeGithubOutput = ({ declaredVersion, latestVersion, isUpToDate }) => {
  const outputPath = process.env.GITHUB_OUTPUT;

  if (!outputPath) {
    return;
  }

  const lines = [
    `declared_version=${declaredVersion}`,
    `latest_version=${latestVersion}`,
    `is_up_to_date=${isUpToDate}`
  ];

  appendFileSync(outputPath, `${lines.join('\n')}\n`);
};

const main = async () => {
  const { requireLatest, allowStale, printLatest } = parseArgs(process.argv);
  const declaredVersion = readDeclaredVersion();
  const latestVersion = readLatestVersion();
  const isUpToDate = declaredVersion === latestVersion;

  writeGithubOutput({ declaredVersion, latestVersion, isUpToDate });

  if (printLatest) {
    console.log(latestVersion);
    return;
  }

  if (isUpToDate) {
    console.log(`libqc is up to date (${declaredVersion}).`);
    return;
  }

  if (requireLatest && !allowStale) {
    fail(
      `libqc is stale: pinned=${declaredVersion}, latest=${latestVersion}. Set ALLOW_STALE_LIBQC_RELEASE=true only for explicit emergency overrides.`
    );
  }

  if (requireLatest && allowStale) {
    console.warn(
      `Proceeding with explicit stale override: pinned=${declaredVersion}, latest=${latestVersion}.`
    );
    return;
  }

  console.log(
    `libqc update available: pinned=${declaredVersion}, latest=${latestVersion}.`
  );
};

await main();
