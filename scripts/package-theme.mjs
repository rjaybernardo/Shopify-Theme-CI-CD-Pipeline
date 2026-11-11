import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../theme/', import.meta.url));
const destination = fileURLToPath(new URL('../dist/theme/', import.meta.url));
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, {
  recursive: true,
  filter: (path) => !path.endsWith('.theme-check.yml'),
});
console.log('Packaged theme in dist/theme');
