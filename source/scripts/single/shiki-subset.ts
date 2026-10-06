import { createHighlighterCore, type CodeToTokensOptions, type HighlighterCore } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import githubDark from 'shiki/themes/github-dark.mjs'
import githubLight from 'shiki/themes/github-light.mjs'
import wasm from 'shiki/wasm'
import { LANGUAGES } from './languages.ts'

/**
 * What `import('shiki')` is in the one-file page: `codeToTokens` for the languages of `./languages.ts` and the two themes of
 * `src/lib/highlight.ts`, on the same engine as Shiki's own, so that a line is coloured as it is in the built page. The build puts this in
 * the place of Shiki's whole bundle, which holds every language. A language that is not in the list is refused as one that Shiki does
 * not know is, and `tokenize` then shows the file as plain text. The highlighter is made when the page first imports this, which is
 * when the first file is to be coloured, and not before.
 */
const highlighter: Promise<HighlighterCore> = createHighlighterCore({
  themes: [githubLight, githubDark],
  langs: Object.values(LANGUAGES),
  engine: createOnigurumaEngine(wasm),
})

export async function codeToTokens(code: string, options: CodeToTokensOptions) {
  return (await highlighter).codeToTokens(code, options)
}
