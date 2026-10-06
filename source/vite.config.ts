import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // Relative, so that the built Jared loads from any path: a server may put it under a secret path.
  base: './',
  plugins: [react()],
  test: {
    coverage: {
      provider: 'v8',
      // Business logic: the folders that hold no UI, and this coverage tool itself.
      // What is left out of the report is decided in scripts/coverage-exclusions.md, run with `npm run coverage`.
      include: ['src/lib/**/*.ts', 'src/state/**/*.ts', 'src/engine/**/*.ts', 'scripts/coverage/**/*.ts', 'scripts/engine/**/*.ts', 'scripts/single/**/*.ts', 'scripts/publish/**/*.ts'],
      exclude: ['**/*.test.ts'],
      reporter: ['json'],
    },
  },
})
