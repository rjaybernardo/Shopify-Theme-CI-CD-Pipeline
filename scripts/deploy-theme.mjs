import { execFileSync } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { verifyBundle } from './theme-bundle.mjs';

export function deploymentConfig(env) {
  const store = env.SHOPIFY_FLAG_STORE || '';
  const id = env.THEME_ID || '';
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(store))
    throw new Error('Use the exact myshopify.com store domain');
  if (!/^[1-9][0-9]*$/.test(id))
    throw new Error('A numeric theme ID is required');
  if (!env.SHOPIFY_CLI_THEME_TOKEN)
    throw new Error('Missing Theme Access password');
  if (!['staging', 'production'].includes(env.DEPLOY_ENVIRONMENT))
    throw new Error('Invalid deployment environment');
  const production = env.DEPLOY_ENVIRONMENT === 'production';
  if (production && env.CONFIRM_THEME_ID !== id)
    throw new Error('Confirmation must match the production theme ID');
  const args = [
    'theme',
    'push',
    '--path',
    'dist/theme',
    '--theme',
    id,
    '--nodelete',
    '--ignore',
    'config/settings_data.json',
    '--json',
  ];
  if (env.MANAGE_THEME_EDITOR_JSON !== 'true')
    args.push(
      '--ignore',
      'templates/*.json',
      '--ignore',
      'templates/customers/*.json',
      '--ignore',
      'sections/*.json',
    );
  if (production && env.ALLOW_LIVE === 'true') args.push('--allow-live');
  return { store, id, production, args };
}

export function validateTarget(themes, config, allowLive) {
  if (!Array.isArray(themes)) throw new Error('Unexpected theme list response');
  const target = themes.find((theme) => String(theme.id) === config.id);
  if (!target)
    throw new Error('Configured theme not found in configured store');
  if (!['unpublished', 'live'].includes(target.role))
    throw new Error('Use a permanent staging or production theme');
  if (target.role === 'live' && (!config.production || allowLive !== 'true'))
    throw new Error(
      'Live theme requires production and explicit allow-live selection',
    );
}

export async function deploy(env = process.env) {
  const config = deploymentConfig(env);
  const manifest = await verifyBundle(
    'dist',
    env.EXPECTED_COMMIT,
    env.EXPECTED_RUN_ID,
  );
  const cli =
    process.platform === 'win32'
      ? 'node_modules/.bin/shopify.cmd'
      : 'node_modules/.bin/shopify';
  const options = {
    encoding: 'utf8',
    env: { ...env, SHOPIFY_FLAG_NO_INPUT: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  };
  const themes = JSON.parse(
    execFileSync(cli, ['theme', 'list', '--json'], options),
  );
  validateTarget(themes, config, env.ALLOW_LIVE);
  execFileSync(cli, config.args, {
    ...options,
    stdio: ['ignore', 'inherit', 'pipe'],
  });
  const summary = `Deployed ${manifest.commit} (CI run ${manifest.runId}) to ${config.store}, theme ${config.id}.\n`;
  console.log(summary);
  if (env.GITHUB_STEP_SUMMARY)
    await appendFile(env.GITHUB_STEP_SUMMARY, summary);
}

if (process.argv[1]?.endsWith('/deploy-theme.mjs')) {
  try {
    await deploy();
  } catch (error) {
    console.error(
      error.status
        ? 'Shopify command failed. Check credentials, theme access, and configuration.'
        : error.message,
    );
    process.exitCode = 1;
  }
}
