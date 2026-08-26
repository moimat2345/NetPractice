import { defineConfig } from 'vite';

export default defineConfig({
  build: { outDir: 'dist', sourcemap: true },
  test: { environment: 'node', coverage: { reporter: ['text', 'html'] } },
});
