import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],     // add more entry points if you like
  format: ['esm', 'cjs'],      // Emits both ./dist/esm & ./dist/cjs
  bundle: false,               // <-- disables bundling
  dts: true,                   // generate *.d.ts once
  sourcemap: true,
  clean: true,                 // wipe dist/ between runs
  outDir: 'dist',
});
