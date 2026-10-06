import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, type Plugin } from 'vite'
import { bundledLanguagesInfo } from 'shiki/langs'
import { inlinePage } from './inline.ts'
import { LANGS_MODULE_ID, languagesModule } from './langs-info.ts'
import { LANGUAGE_IDS } from './languages.ts'

/** The name of the file that is written: Jared as one page. */
export const PAGE_FILE = 'jared.html'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const CONFIG = join(ROOT, 'vite.config.ts')
const SHIKI_SUBSET = fileURLToPath(new URL('./shiki-subset.ts', import.meta.url))
const LANGS_VIRTUAL = '\0jared-single-languages'

/** Puts the information of the languages in the place of `shiki/langs`, which names all of them. */
const languages: Plugin = {
  name: 'jared-single-languages',
  enforce: 'pre',
  resolveId: (id) => (id === LANGS_MODULE_ID ? LANGS_VIRTUAL : null),
  load: (id) => (id === LANGS_VIRTUAL ? languagesModule(bundledLanguagesInfo, LANGUAGE_IDS) : null),
}

/** Collects into `into` the names of the packages of `node_modules` that have code in the build's output, which the notices for the page name. */
const packagesInPage = (into: Set<string>): Plugin => ({
  name: 'jared-single-packages',
  generateBundle(_options, bundle) {
    for (const item of Object.values(bundle)) {
      if (item.type !== 'chunk') continue
      for (const id of Object.keys(item.modules)) {
        const found = /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(id)
        if (found) into.add(found[1])
      }
    }
  },
})

/**
 * Builds Jared as one file into `out`: the usual production build, with Shiki's languages cut to the common ones
 * (`languages.ts`) and every file of the build folded into the script (`codeSplitting: false`), and then the script, the stylesheet and
 * the icon put into the page itself (`inlinePage`). The usual build is made into a folder of its own, in `temporary`, that is removed,
 * never into `dist/`.
 */
export async function buildSinglePage(out: string, temporary = tmpdir()): Promise<{ file: string; bytes: number; packages: string[] }> {
  const work = await mkdtemp(join(temporary, 'jared-single-build-'))
  // The test runner says NODE_ENV is "test", which would build the development page; `npm run build` builds the production one.
  const inPage = new Set<string>()
  const before = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    await build({
      root: ROOT,
      configFile: CONFIG,
      logLevel: 'silent',
      plugins: [languages, packagesInPage(inPage)],
      resolve: { alias: [{ find: /^shiki$/, replacement: SHIKI_SUBSET }] },
      build: {
        outDir: work,
        emptyOutDir: true,
        rolldownOptions: { output: { codeSplitting: false } },
      },
    })
    const page = inlinePage(await readFile(join(work, 'index.html'), 'utf8'), (path) => readFileSync(join(work, path), 'utf8'))
    await mkdir(out, { recursive: true })
    const file = join(out, PAGE_FILE)
    await writeFile(file, page)
    return { file, bytes: Buffer.byteLength(page), packages: [...inPage].sort() }
  } finally {
    if (before === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = before
    await rm(work, { recursive: true, force: true })
  }
}
