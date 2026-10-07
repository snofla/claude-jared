import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Relative, so that the built Jared loads from any path: a server may put it under a secret path.
  base: './',
  // The version that the page says it is: the package's number in a build, and "dev" for the dev server and the tests.
  define: { __JARED_VERSION__: JSON.stringify(command === 'build' ? version : 'dev') },
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
}))
