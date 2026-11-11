import { verifyBundle } from './theme-bundle.mjs';

const manifest = await verifyBundle(
  'dist',
  process.env.EXPECTED_COMMIT,
  process.env.EXPECTED_RUN_ID,
);
console.log(`Verified bundle for ${manifest.commit}`);
