import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Relative, so that the built Jared loads from any path: a server may put it under a secret path.
  base: './',
  // The version that the page says it is: the package's number in a build, and "dev" for the dev server and the tests.
  define: { __JARED_VERSION__: JSON.stringify(command === 'build' ? version : 'dev') },
  plugins: [react()],
  test: {
    // Half of the cores run the tests: a full run takes as long as with all but one of them (57 s against 61 s on a machine of 12 cores), with 16 to 40% less memory and about 8% less CPU, and it leaves the rest of the machine to other work.
    maxWorkers: '50%',
    // The tests of the interface have a configuration of their own (`vitest.ui.config.ts`), which their command and the checks before a merge use; this configuration never runs them.
    exclude: [...configDefaults.exclude, '**/*.ui.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // Business logic: the folders that hold no UI, and this coverage tool itself.
      // What is left out of the report is decided in scripts/coverage-exclusions.md, run with `npm run coverage`.
      include: ['src/lib/**/*.ts', 'src/state/**/*.ts', 'src/engine/**/*.ts', 'src/ui/**/*.ts', 'scripts/checks/**/*.ts', 'scripts/coverage/**/*.ts', 'scripts/engine/**/*.ts', 'scripts/single/**/*.ts', 'scripts/publish/**/*.ts', 'scripts/task/**/*.ts'],
      exclude: ['**/*.test.ts'],
      reporter: ['json'],
    },
  },
}))
