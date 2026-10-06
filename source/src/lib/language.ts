import { bundledLanguagesInfo } from 'shiki/langs'

export const PLAIN_TEXT = 'text'

/** The language of a text that is a unified diff. One that has a hunk in it is shown as a diff (`src/lib/diff.ts`). */
export const DIFF_LANGUAGE = 'diff'

export interface LanguageOption {
  id: string
  name: string
}

/** Every id and alias Shiki knows, resolved to its canonical id. */
const TO_ID = new Map<string, string>()
for (const info of bundledLanguagesInfo) {
  TO_ID.set(info.id.toLowerCase(), info.id)
  for (const alias of info.aliases ?? []) TO_ID.set(alias.toLowerCase(), info.id)
}

const NAMES = new Map(bundledLanguagesInfo.map((info) => [info.id, info.name]))

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { id: PLAIN_TEXT, name: 'Plain text' },
  ...bundledLanguagesInfo
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name)),
]

export function languageName(id: string): string {
  return id === PLAIN_TEXT ? 'Plain text' : (NAMES.get(id) ?? id)
}

/** Extensions whose Shiki alias is missing or points somewhere unhelpful. */
const EXTENSIONS: Record<string, string> = {
  mjs: 'javascript',
  cjs: 'javascript',
  h: 'c',
  hh: 'cpp',
  hpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  ino: 'cpp',
  pyi: 'python',
  pyw: 'python',
  bash: 'shellscript',
  zsh: 'shellscript',
  env: 'dotenv',
  conf: 'ini',
  cfg: 'ini',
  htm: 'html',
  tf: 'terraform',
  tfvars: 'terraform',
  gradle: 'groovy',
  patch: DIFF_LANGUAGE,
  txt: PLAIN_TEXT,
}

const FILENAMES: Record<string, string> = {
  dockerfile: 'docker',
  makefile: 'make',
  gnumakefile: 'make',
  'cmakelists.txt': 'cmake',
  gemfile: 'ruby',
  rakefile: 'ruby',
  '.env': 'dotenv',
  '.bashrc': 'shellscript',
  '.zshrc': 'shellscript',
  '.gitignore': PLAIN_TEXT,
}

const SHEBANGS: Array<[RegExp, string]> = [
  [/\b(node|deno|bun)\b/, 'javascript'],
  [/\bpython[\d.]*\b/, 'python'],
  [/\bruby\b/, 'ruby'],
  [/\bperl\b/, 'perl'],
  [/\bphp\b/, 'php'],
  [/\b(ba|z|k|da)?sh\b/, 'shellscript'],
]

/** Best-effort language guess from the file name, falling back to a shebang line. */
export function detectLanguage(fileName: string, firstLine = ''): string {
  const base = fileName.split(/[\\/]/).pop()!.toLowerCase()
  if (base in FILENAMES) return FILENAMES[base]

  const dot = base.lastIndexOf('.')
  const ext = dot >= 0 ? base.slice(dot + 1) : ''
  if (ext) {
    if (ext in EXTENSIONS) return EXTENSIONS[ext]
    const id = TO_ID.get(ext)
    if (id) return id
  }

  if (firstLine.startsWith('#!')) {
    for (const [pattern, id] of SHEBANGS) if (pattern.test(firstLine)) return id
  }
  return PLAIN_TEXT
}
