import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

const directories = new Set([
  'assets',
  'blocks',
  'config',
  'layout',
  'locales',
  'sections',
  'snippets',
  'templates',
]);

export async function inventory(root, strict = false) {
  const files = {};
  async function visit(relative = '') {
    const entries = await readdir(`${root}/${relative}`, {
      withFileTypes: true,
    });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Symlink forbidden: ${path}`);
      if (
        entry.name.startsWith('.') ||
        path === 'config/settings_data.json' ||
        (!relative && !directories.has(entry.name))
      ) {
        if (strict) throw new Error(`Unexpected bundle file: ${path}`);
        continue;
      }
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile())
        files[path] = createHash('sha256')
          .update(await readFile(`${root}/${path}`))
          .digest('hex');
      else throw new Error(`Unsupported file: ${path}`);
    }
  }
  await visit();
  return files;
}

export async function verifyBundle(root, expectedCommit, expectedRun) {
  const manifest = JSON.parse(await readFile(`${root}/manifest.json`, 'utf8'));
  if (manifest.version !== 1 || !/^[0-9a-f]{40}$/.test(manifest.commit))
    throw new Error('Invalid bundle manifest');
  if (expectedCommit && manifest.commit !== expectedCommit)
    throw new Error('Commit mismatch');
  if (expectedRun && String(manifest.runId) !== String(expectedRun))
    throw new Error('Run mismatch');
  const actual = await inventory(`${root}/theme`, true);
  const paths = Object.keys(actual);
  if (
    !actual['layout/theme.liquid'] ||
    paths.length !== Object.keys(manifest.files).length ||
    paths.some((path) => actual[path] !== manifest.files[path])
  )
    throw new Error('Theme files do not match bundle manifest');
  return manifest;
}
