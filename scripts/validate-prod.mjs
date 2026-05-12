import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

const DIST = 'dist';
const errors = [];

function fail(msg) {
  errors.push(msg);
}

if (!existsSync(DIST)) {
  fail('dist/ directory missing - run pnpm build:prod first');
  report();
  process.exit(1);
}

// manifest.json
const manifestPath = join(DIST, 'manifest.json');
if (!existsSync(manifestPath)) {
  fail('dist/manifest.json missing');
} else {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    fail('dist/manifest.json is not valid JSON');
  }
  if (manifest) {
    if (manifest.manifest_version !== 3) {
      fail(`manifest_version is ${manifest.manifest_version}, expected 3`);
    }
    if (!manifest.content_security_policy?.extension_pages) {
      fail('manifest.json missing content_security_policy.extension_pages - CSP may have been stripped');
    }
  }
}

// popup entry point
if (!existsSync(join(DIST, 'index.html'))) {
  fail('dist/index.html missing - popup entry point not emitted');
}

// at least one non-empty JS bundle
const assetsDir = join(DIST, 'assets');
const jsBundles = existsSync(assetsDir)
  ? readdirSync(assetsDir).filter(f => f.endsWith('.js') && statSync(join(assetsDir, f)).size > 0)
  : [];

if (jsBundles.length === 0) {
  fail('no non-empty JS bundles found in dist/assets/');
}

function report() {
  if (errors.length === 0) {
    console.log(`validate:prod passed (manifest v3, CSP present, index.html, ${jsBundles.length} JS bundle(s))`);
  } else {
    for (const e of errors) console.error(`ERROR: ${e}`);
  }
}

report();
if (errors.length > 0) process.exit(1);
