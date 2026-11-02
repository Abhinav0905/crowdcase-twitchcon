import { build } from 'esbuild';
import { rm, mkdir, cp } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await build({ entryPoints: ['src/app.js', 'src/sandbox.worker.js'], outdir: 'dist', bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: false });
console.log('Built CrowdCase, including its local QuickJS WASM runner.');
