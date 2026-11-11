import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inventory, verifyBundle } from '../scripts/theme-bundle.mjs';
import { validateRun } from '../scripts/resolve-release.mjs';
import { deploymentConfig, validateTarget } from '../scripts/deploy-theme.mjs';

const commit = 'a'.repeat(40);
test('bundle detects altered, missing, extra files and wrong provenance', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'theme-bundle-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(`${root}/theme/layout`, { recursive: true });
  await writeFile(`${root}/theme/layout/theme.liquid`, 'original');
  await writeFile(
    `${root}/manifest.json`,
    JSON.stringify({
      version: 1,
      commit,
      runId: '123',
      files: await inventory(`${root}/theme`),
    }),
  );
  await verifyBundle(root, commit, '123');
  await assert.rejects(
    verifyBundle(root, 'b'.repeat(40), '123'),
    /Commit mismatch/,
  );
  await assert.rejects(verifyBundle(root, commit, '124'), /Run mismatch/);
  await writeFile(`${root}/theme/layout/theme.liquid`, 'modified');
  await assert.rejects(verifyBundle(root), /manifest/);
  await writeFile(`${root}/theme/layout/theme.liquid`, 'original');
  await writeFile(`${root}/theme/layout/extra.liquid`, 'extra');
  await assert.rejects(verifyBundle(root), /manifest/);
  await rm(`${root}/theme/layout/extra.liquid`);
  await mkdir(`${root}/theme/config`);
  await writeFile(`${root}/theme/config/settings_data.json`, '{}');
  await assert.rejects(verifyBundle(root), /Unexpected bundle file/);
  await rm(`${root}/theme/config/settings_data.json`);
  await rm(`${root}/theme/layout/theme.liquid`);
  await assert.rejects(verifyBundle(root), /manifest/);
});
test('packaging omits merchant settings and rejects symlinks', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'theme-source-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(`${root}/config`);
  await writeFile(`${root}/config/settings_data.json`, '{}');
  await writeFile(`${root}/.env`, 'private');
  assert.deepEqual(await inventory(root), {});
  await symlink(`${root}/.env`, `${root}/config/leak.json`);
  await assert.rejects(inventory(root), /Symlink forbidden/);
});
const run = {
  status: 'completed',
  conclusion: 'success',
  event: 'push',
  head_branch: 'main',
  path: '.github/workflows/ci.yml',
  repository: { full_name: 'owner/repo' },
  head_repository: { full_name: 'owner/repo' },
  head_sha: commit,
};
test('releases reject failed, PR, fork, and unrelated workflow builds', () => {
  assert.equal(validateRun(run, 'owner/repo'), commit);
  for (const change of [
    { conclusion: 'failure' },
    { event: 'pull_request' },
    { head_branch: 'feature' },
    { path: '.github/workflows/other.yml' },
    { head_repository: { full_name: 'fork/repo' } },
  ])
    assert.throws(() => validateRun({ ...run, ...change }, 'owner/repo'));
});
const env = {
  SHOPIFY_FLAG_STORE: 'demo.myshopify.com',
  THEME_ID: '123',
  SHOPIFY_CLI_THEME_TOKEN: 'test-only',
  DEPLOY_ENVIRONMENT: 'staging',
};
test('deployment preserves merchant JSON and remote files by default', () => {
  const { args } = deploymentConfig(env);
  for (const value of [
    '--nodelete',
    'templates/*.json',
    'sections/*.json',
    'config/settings_data.json',
  ])
    assert.ok(args.includes(value));
  assert.ok(!args.includes('--allow-live'));
  assert.ok(
    !deploymentConfig({ ...env, ALLOW_LIVE: 'true' }).args.includes(
      '--allow-live',
    ),
  );
});
test('production requires target confirmation and explicit live opt-in', () => {
  assert.throws(
    () => deploymentConfig({ ...env, DEPLOY_ENVIRONMENT: 'production' }),
    /Confirmation/,
  );
  const args = deploymentConfig({
    ...env,
    DEPLOY_ENVIRONMENT: 'production',
    CONFIRM_THEME_ID: '123',
    ALLOW_LIVE: 'true',
    MANAGE_THEME_EDITOR_JSON: 'true',
  }).args;
  assert.ok(args.includes('--allow-live'));
  assert.ok(!args.includes('templates/*.json'));
  assert.throws(
    () =>
      deploymentConfig({ ...env, SHOPIFY_FLAG_STORE: 'https://example.com' }),
    /domain/,
  );
  assert.throws(
    () => deploymentConfig({ ...env, THEME_ID: '--live' }),
    /numeric/,
  );
});
test('target guard rejects live staging, development themes, and wrong IDs', () => {
  const staging = deploymentConfig(env);
  const live = [{ id: 123, role: 'live' }];
  assert.throws(() => validateTarget(live, staging, 'true'), /Live theme/);
  assert.throws(
    () => validateTarget([{ id: 123, role: 'development' }], staging),
    /permanent/,
  );
  assert.throws(
    () => validateTarget([{ id: 456, role: 'unpublished' }], staging),
    /not found/,
  );
  validateTarget([{ id: 123, role: 'unpublished' }], staging);
  const production = deploymentConfig({
    ...env,
    DEPLOY_ENVIRONMENT: 'production',
    CONFIRM_THEME_ID: '123',
  });
  assert.throws(() => validateTarget(live, production, 'false'), /Live theme/);
  validateTarget(live, production, 'true');
});
