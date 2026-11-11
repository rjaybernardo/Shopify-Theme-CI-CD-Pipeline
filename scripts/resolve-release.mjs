import { appendFile } from 'node:fs/promises';

export function validateRun(run, repository) {
  if (
    run.status !== 'completed' ||
    run.conclusion !== 'success' ||
    run.event !== 'push' ||
    run.head_branch !== 'main' ||
    run.path !== '.github/workflows/ci.yml' ||
    run.repository?.full_name !== repository ||
    run.head_repository?.full_name !== repository ||
    !/^[0-9a-f]{40}$/.test(run.head_sha)
  )
    throw new Error(
      'Choose a successful Theme CI push run from main in this repository',
    );
  return run.head_sha;
}

export async function resolveRelease(env = process.env) {
  const {
    BUILD_RUN_ID: id,
    GITHUB_REPOSITORY: repository,
    GH_TOKEN: token,
  } = env;
  if (!/^[0-9]+$/.test(id || ''))
    throw new Error('A numeric CI run ID is required');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !token)
    throw new Error('Missing GitHub configuration');
  const response = await fetch(
    `https://api.github.com/repos/${repository}/actions/runs/${id}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    },
  );
  if (!response.ok)
    throw new Error(`Cannot inspect CI run: HTTP ${response.status}`);
  const commit = validateRun(await response.json(), repository);
  await appendFile(
    env.GITHUB_OUTPUT,
    `commit=${commit}\nartifact=theme-${commit}\n`,
  );
}

if (process.argv[1]?.endsWith('/resolve-release.mjs')) await resolveRelease();
