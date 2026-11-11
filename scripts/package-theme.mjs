import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inventory } from './theme-bundle.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = `${root}theme`;
const destination = `${root}dist`;
const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
const files = await inventory(source);
if (!files['layout/theme.liquid']) throw new Error('Missing theme layout');
await rm(destination, { recursive: true, force: true });
await mkdir(`${destination}/theme`, { recursive: true });
for (const path of Object.keys(files)) {
  await mkdir(`${destination}/theme/${path.slice(0, path.lastIndexOf('/'))}`, {
    recursive: true,
  });
  await cp(`${source}/${path}`, `${destination}/theme/${path}`);
}
await writeFile(
  `${destination}/manifest.json`,
  JSON.stringify(
    { version: 1, commit, runId: process.env.GITHUB_RUN_ID || null, files },
    null,
    2,
  ) + '\n',
);
console.log(`Packaged ${Object.keys(files).length} files and SHA-256 manifest`);
