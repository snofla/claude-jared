import { resolve } from 'node:path'
import { BOOT_FILE } from './inline.ts'
import { buildSinglePage } from './build.ts'

const USAGE = `Usage: node scripts/single/build-single.ts [--out <folder>]

Builds Jared as one file, jared.html, that opens from a path with no server. Default folder: dist-single (git ignores it).
A script beside it, ${BOOT_FILE}, can hand it a request: see src/lib/fragment-link.ts.`

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE)
} else if (args.length === 0 || (args.length === 2 && args[0] === '--out')) {
  const { file, bytes } = await buildSinglePage(resolve(args[1] ?? 'dist-single'))
  console.log(`Wrote ${file} (${(bytes / 1_000_000).toFixed(1)} MB).`)
} else {
  console.error(USAGE)
  process.exitCode = 2
}
