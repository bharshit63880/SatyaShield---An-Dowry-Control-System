import { spawnSync } from 'node:child_process';

const enabled = process.env.RUN_MONGODB_TESTS === 'true';
if (!enabled) {
  console.log('MongoDB runtime tests skipped: set RUN_MONGODB_TESTS=true to enable them.');
  process.exit(0);
}

const uri = String(process.env.MONGODB_URI || '').trim();
if (!uri) {
  console.error('MongoDB runtime tests refused: MONGODB_URI is required.');
  process.exit(1);
}

let databaseName = '';
try {
  const parsed = new URL(uri);
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol)) throw new Error('invalid protocol');
  databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
} catch {
  console.error('MongoDB runtime tests refused: MONGODB_URI must be a valid MongoDB URI.');
  process.exit(1);
}

if (!/^ss_p10_rt_[a-z0-9_]+$/i.test(databaseName)) {
  console.error(
    'MongoDB runtime tests refused: database name must match ss_p10_rt_* and be dedicated to tests.'
  );
  process.exit(1);
}

const requestedFiles = process.argv.slice(2);
const testFiles = requestedFiles.length ? requestedFiles : ['test/runtime/*.test.js'];
const result = spawnSync(
  process.execPath,
  ['--test', '--test-concurrency=1', '--test-force-exit', ...testFiles],
  { stdio: 'inherit', shell: process.platform === 'win32', env: process.env }
);

if (result.error) {
  console.error(`Unable to start MongoDB runtime tests: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
