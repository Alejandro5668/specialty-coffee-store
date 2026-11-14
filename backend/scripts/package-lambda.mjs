// Builds backend/build/lambda: the compiled app plus its production dependencies, ready to zip.
// It uses tsc, not a bundler, because Nest needs the decorator metadata that esbuild drops.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const backend = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(backend, '..');
const out = join(backend, 'build', 'lambda');
const run = (command, args, cwd) => execFileSync(command, args, { cwd, stdio: 'pipe' });

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
run('npx', ['tsc', '-p', 'tsconfig.build.json', '--outDir', out], backend);

// Install from the root lockfile, so the versions are the ones that were tested.
const scratch = mkdtempSync(join(tmpdir(), 'lambda-deps-'));
try {
  for (const file of ['package.json', 'package-lock.json'])
    cpSync(join(root, file), join(scratch, file));
  for (const workspace of ['backend', 'frontend']) {
    mkdirSync(join(scratch, workspace));
    cpSync(join(root, workspace, 'package.json'), join(scratch, workspace, 'package.json'));
  }
  run(
    'npm',
    ['ci', '--omit=dev', '--workspace', 'backend', '--ignore-scripts', '--no-audit', '--no-fund'],
    scratch,
  );
  const modules = join(scratch, 'node_modules');
  for (const link of ['backend', 'frontend'])
    rmSync(join(modules, link), { recursive: true, force: true });
  cpSync(modules, join(out, 'node_modules'), { recursive: true, verbatimSymlinks: true });
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
writeFileSync(join(out, 'package.json'), '{ "private": true, "type": "commonjs" }\n');

const count = readdirSync(join(out, 'node_modules')).filter((name) => !name.startsWith('.')).length;
console.log(`Packaged ${count} dependencies into ${out}`);
