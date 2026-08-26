import { defineConfig } from 'vite';

export default defineConfig({
  build: { outDir: 'dist', sourcemap: true },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    coverage: { reporter: ['text', 'html'] },
  },
});
