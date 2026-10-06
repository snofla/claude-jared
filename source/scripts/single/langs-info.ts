/** What Shiki says about a language: the part of its information that Jared reads (`src/lib/language.ts`). */
export interface LanguageInfo {
  id: string
  name: string
  aliases?: string[]
}

/** The module that stands in for `shiki/langs`: only the information of the given languages, as Shiki gives it. */
export const languagesModule = (all: readonly LanguageInfo[], ids: readonly string[]): string =>
  `export const bundledLanguagesInfo = ${JSON.stringify(all.filter((info) => ids.includes(info.id)))}\n`

/**
 * What the one-file page needs of `shiki/langs`, which is the names and aliases of the languages it can colour and not of every
 * language Shiki has, so that the language list of the page and the guess from a file's name offer only what is coloured. It is a
 * module of its own, written at the build from Shiki's own information, because Shiki's file for it also names every grammar,
 * which the one file would then hold.
 */
export const LANGS_MODULE_ID = 'shiki/langs'
